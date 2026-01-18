import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { 
  Building2, 
  Users, 
  GraduationCap, 
  CreditCard, 
  AlertCircle,
  Search,
  Plus,
  MoreVertical,
  Clock,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Eye,
  FileText,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  status: "active" | "disabled" | "suspended";
  students: number;
  teachers: number;
  monthlyRevenue: number;
  errors24h: number;
  lastActivity: string;
  subscriptionStatus: "active" | "trial" | "expired";
  subscriptionPlan: "monthly" | "yearly" | "trial";
  createdAt: string;
}

const initialBranches: Branch[] = [
  {
    id: "1",
    name: "Moscow Central",
    city: "Moscow",
    address: "Tverskaya st. 15, Building 2",
    phone: "+7 495 123-45-67",
    email: "moscow@wonderkids.ru",
    status: "active",
    students: 245,
    teachers: 18,
    monthlyRevenue: 890000,
    errors24h: 0,
    lastActivity: "2 min ago",
    subscriptionStatus: "active",
    subscriptionPlan: "yearly",
    createdAt: "2022-03-15",
  },
  {
    id: "2",
    name: "Saint Petersburg Main",
    city: "Saint Petersburg",
    address: "Nevsky Prospect 78",
    phone: "+7 812 234-56-78",
    email: "spb@wonderkids.ru",
    status: "active",
    students: 189,
    teachers: 14,
    monthlyRevenue: 720000,
    errors24h: 2,
    lastActivity: "5 min ago",
    subscriptionStatus: "active",
    subscriptionPlan: "monthly",
    createdAt: "2022-06-20",
  },
  {
    id: "3",
    name: "Kazan Academy",
    city: "Kazan",
    address: "Bauman st. 42",
    phone: "+7 843 345-67-89",
    email: "kazan@wonderkids.ru",
    status: "suspended",
    students: 76,
    teachers: 6,
    monthlyRevenue: 0,
    errors24h: 12,
    lastActivity: "3 days ago",
    subscriptionStatus: "expired",
    subscriptionPlan: "monthly",
    createdAt: "2023-01-10",
  },
  {
    id: "4",
    name: "Sochi Campus",
    city: "Sochi",
    address: "Kurortniy Prospect 120",
    phone: "+7 862 456-78-90",
    email: "sochi@wonderkids.ru",
    status: "active",
    students: 112,
    teachers: 9,
    monthlyRevenue: 445000,
    errors24h: 1,
    lastActivity: "15 min ago",
    subscriptionStatus: "trial",
    subscriptionPlan: "trial",
    createdAt: "2024-01-05",
  },
  {
    id: "5",
    name: "Novosibirsk Center",
    city: "Novosibirsk",
    address: "Krasny Prospect 65",
    phone: "+7 383 567-89-01",
    email: "nsk@wonderkids.ru",
    status: "active",
    students: 98,
    teachers: 8,
    monthlyRevenue: 380000,
    errors24h: 0,
    lastActivity: "1 hour ago",
    subscriptionStatus: "active",
    subscriptionPlan: "yearly",
    createdAt: "2023-06-15",
  },
];

export default function Branches() {
  const [searchQuery, setSearchQuery] = useState("");
  const [branchData, setBranchData] = useState(initialBranches);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    address: "",
    phone: "",
    email: "",
    subscriptionPlan: "trial" as "monthly" | "yearly" | "trial",
  });

  const filteredBranches = branchData.filter(
    (branch) =>
      branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleBranch = (id: string) => {
    setBranchData((prev) =>
      prev.map((branch) =>
        branch.id === id
          ? {
              ...branch,
              status: branch.status === "active" ? "disabled" : "active",
            }
          : branch
      )
    );
    toast.success("Branch status updated");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleAddBranch = () => {
    const newBranch: Branch = {
      id: Date.now().toString(),
      name: formData.name,
      city: formData.city,
      address: formData.address,
      phone: formData.phone,
      email: formData.email,
      status: "active",
      students: 0,
      teachers: 0,
      monthlyRevenue: 0,
      errors24h: 0,
      lastActivity: "Just now",
      subscriptionStatus: formData.subscriptionPlan === "trial" ? "trial" : "active",
      subscriptionPlan: formData.subscriptionPlan,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setBranchData((prev) => [...prev, newBranch]);
    setIsAddModalOpen(false);
    resetForm();
    toast.success("Branch created successfully");
  };

  const handleEditBranch = () => {
    if (!selectedBranch) return;
    setBranchData((prev) =>
      prev.map((branch) =>
        branch.id === selectedBranch.id
          ? { 
              ...branch, 
              name: formData.name, 
              city: formData.city, 
              address: formData.address,
              phone: formData.phone,
              email: formData.email,
            }
          : branch
      )
    );
    setIsEditModalOpen(false);
    setSelectedBranch(null);
    toast.success("Branch updated successfully");
  };

  const handleDeleteBranch = () => {
    if (!selectedBranch) return;
    setBranchData((prev) => prev.filter((branch) => branch.id !== selectedBranch.id));
    setIsDeleteDialogOpen(false);
    setSelectedBranch(null);
    toast.success("Branch deleted successfully");
  };

  const resetForm = () => {
    setFormData({
      name: "",
      city: "",
      address: "",
      phone: "",
      email: "",
      subscriptionPlan: "trial",
    });
  };

  const openEditModal = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      name: branch.name,
      city: branch.city,
      address: branch.address,
      phone: branch.phone,
      email: branch.email,
      subscriptionPlan: branch.subscriptionPlan,
    });
    setIsEditModalOpen(true);
  };

  const openViewModal = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsViewModalOpen(true);
  };

  const openDeleteDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsDeleteDialogOpen(true);
  };

  const openLogsModal = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsLogsModalOpen(true);
  };

  const totalStudents = branchData.reduce((sum, b) => sum + b.students, 0);
  const totalRevenue = branchData.reduce((sum, b) => sum + b.monthlyRevenue, 0);
  const activeBranches = branchData.filter((b) => b.status === "active").length;

  const branchLogs = [
    { time: "2024-01-14 14:32", level: "INFO", message: "Student enrollment: std_123" },
    { time: "2024-01-14 14:28", level: "INFO", message: "Payment received: ₽15,000" },
    { time: "2024-01-14 14:15", level: "WARN", message: "Slow API response: 1.2s" },
    { time: "2024-01-14 13:45", level: "INFO", message: "Teacher login: teacher@school.ru" },
    { time: "2024-01-14 13:30", level: "ERROR", message: "Email delivery failed" },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Branch Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage all school branches
          </p>
        </div>
        <Button className="gap-2" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Branch
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{branchData.length}</p>
              <p className="text-sm text-muted-foreground">Total Branches</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-healthy/15 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-status-healthy" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeBranches}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-info/15 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-status-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalStudents}</p>
              <p className="text-sm text-muted-foreground">Total Students</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-healthy/15 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-status-healthy" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card rounded-lg p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search branches by name or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background max-w-md"
          />
        </div>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredBranches.map((branch) => (
          <div key={branch.id} className="glass-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center",
                    branch.status === "active" && "bg-status-healthy/15",
                    branch.status === "disabled" && "bg-muted",
                    branch.status === "suspended" && "bg-status-warning/15"
                  )}>
                    <Building2 className={cn(
                      "w-6 h-6",
                      branch.status === "active" && "text-status-healthy",
                      branch.status === "disabled" && "text-muted-foreground",
                      branch.status === "suspended" && "text-status-warning"
                    )} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{branch.name}</h3>
                    <p className="text-sm text-muted-foreground">{branch.city}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "badge-status capitalize",
                    branch.status === "active" && "badge-healthy",
                    branch.status === "disabled" && "bg-muted text-muted-foreground",
                    branch.status === "suspended" && "badge-warning"
                  )}>
                    {branch.status}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openViewModal(branch)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditModal(branch)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Branch
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openLogsModal(branch)}>
                        <FileText className="w-4 h-4 mr-2" />
                        View Logs
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-status-critical"
                        onClick={() => openDeleteDialog(branch)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Branch
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold text-foreground">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    {branch.students}
                  </div>
                  <p className="text-xs text-muted-foreground">Students</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold text-foreground">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {branch.teachers}
                  </div>
                  <p className="text-xs text-muted-foreground">Teachers</p>
                </div>
                <div className="text-center">
                  <div className={cn(
                    "flex items-center justify-center gap-1 text-lg font-semibold",
                    branch.errors24h > 5 && "text-status-critical",
                    branch.errors24h > 0 && branch.errors24h <= 5 && "text-status-warning",
                    branch.errors24h === 0 && "text-status-healthy"
                  )}>
                    <AlertCircle className="w-4 h-4" />
                    {branch.errors24h}
                  </div>
                  <p className="text-xs text-muted-foreground">Errors (24h)</p>
                </div>
              </div>

              {/* Subscription & Activity */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "badge-status",
                      branch.subscriptionStatus === "active" && "badge-healthy",
                      branch.subscriptionStatus === "trial" && "bg-status-info/15 text-status-info",
                      branch.subscriptionStatus === "expired" && "badge-critical"
                    )}>
                      {branch.subscriptionPlan}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {branch.lastActivity}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Enabled</span>
                  <Switch
                    checked={branch.status === "active"}
                    onCheckedChange={() => toggleBranch(branch.id)}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Branch Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Branch</DialogTitle>
            <DialogDescription>
              Create a new school branch in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Branch Name</Label>
                <Input
                  id="name"
                  placeholder="Moscow Central"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Moscow"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="Full street address..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+7 495 123-45-67"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="branch@wonderkids.ru"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Subscription Plan</Label>
              <Select 
                value={formData.subscriptionPlan} 
                onValueChange={(val) => setFormData({ ...formData, subscriptionPlan: val as "monthly" | "yearly" | "trial" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">14-Day Trial</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddBranch} disabled={!formData.name || !formData.city}>
              Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update branch information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Branch Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-city">City</Label>
                <Input
                  id="edit-city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditBranch}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Branch Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Branch Details</DialogTitle>
            <DialogDescription>
              Detailed information about this branch.
            </DialogDescription>
          </DialogHeader>
          {selectedBranch && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-16 h-16 rounded-lg flex items-center justify-center",
                  selectedBranch.status === "active" && "bg-status-healthy/15",
                  selectedBranch.status !== "active" && "bg-muted"
                )}>
                  <Building2 className={cn(
                    "w-8 h-8",
                    selectedBranch.status === "active" && "text-status-healthy",
                    selectedBranch.status !== "active" && "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedBranch.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedBranch.city}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{selectedBranch.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{selectedBranch.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{selectedBranch.email}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Students</p>
                  <p className="font-semibold text-foreground">{selectedBranch.students}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Teachers</p>
                  <p className="font-semibold text-foreground">{selectedBranch.teachers}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Monthly Revenue</p>
                  <p className="font-semibold text-foreground">{formatCurrency(selectedBranch.monthlyRevenue)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-semibold text-foreground">{selectedBranch.createdAt}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Subscription</p>
                  <p className="font-semibold text-foreground capitalize">{selectedBranch.subscriptionPlan}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-semibold text-foreground capitalize">{selectedBranch.status}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setIsViewModalOpen(false);
              if (selectedBranch) openEditModal(selectedBranch);
            }}>
              Edit Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedBranch?.name}"? This will remove all associated data including students, teachers, and payment history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBranch} className="bg-status-critical hover:bg-status-critical/90">
              Delete Branch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logs Modal */}
      <Dialog open={isLogsModalOpen} onOpenChange={setIsLogsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Branch Logs</DialogTitle>
            <DialogDescription>
              Recent activity for {selectedBranch?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-80 overflow-y-auto">
            {branchLogs.map((log, idx) => (
              <div key={idx} className={cn(
                "flex items-start gap-3 p-3 rounded-lg",
                log.level === "INFO" && "bg-status-info/10",
                log.level === "WARN" && "bg-status-warning/10",
                log.level === "ERROR" && "bg-status-critical/10"
              )}>
                <span className={cn(
                  "badge-status text-xs",
                  log.level === "INFO" && "bg-status-info/15 text-status-info",
                  log.level === "WARN" && "badge-warning",
                  log.level === "ERROR" && "badge-critical"
                )}>
                  {log.level}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{log.message}</p>
                  <p className="text-xs text-muted-foreground">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLogsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
