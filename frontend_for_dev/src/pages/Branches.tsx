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
  Activity,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Branch {
  id: string;
  name: string;
  city: string;
  status: "active" | "disabled" | "suspended";
  students: number;
  teachers: number;
  monthlyRevenue: number;
  errors24h: number;
  lastActivity: string;
  subscriptionStatus: "active" | "trial" | "expired";
  subscriptionPlan: "monthly" | "yearly" | "trial";
}

const branches: Branch[] = [
  {
    id: "1",
    name: "Moscow Central",
    city: "Moscow",
    status: "active",
    students: 245,
    teachers: 18,
    monthlyRevenue: 890000,
    errors24h: 0,
    lastActivity: "2 min ago",
    subscriptionStatus: "active",
    subscriptionPlan: "yearly",
  },
  {
    id: "2",
    name: "Saint Petersburg Main",
    city: "Saint Petersburg",
    status: "active",
    students: 189,
    teachers: 14,
    monthlyRevenue: 720000,
    errors24h: 2,
    lastActivity: "5 min ago",
    subscriptionStatus: "active",
    subscriptionPlan: "monthly",
  },
  {
    id: "3",
    name: "Kazan Academy",
    city: "Kazan",
    status: "suspended",
    students: 76,
    teachers: 6,
    monthlyRevenue: 0,
    errors24h: 12,
    lastActivity: "3 days ago",
    subscriptionStatus: "expired",
    subscriptionPlan: "monthly",
  },
  {
    id: "4",
    name: "Sochi Campus",
    city: "Sochi",
    status: "active",
    students: 112,
    teachers: 9,
    monthlyRevenue: 445000,
    errors24h: 1,
    lastActivity: "15 min ago",
    subscriptionStatus: "trial",
    subscriptionPlan: "trial",
  },
  {
    id: "5",
    name: "Novosibirsk Center",
    city: "Novosibirsk",
    status: "active",
    students: 98,
    teachers: 8,
    monthlyRevenue: 380000,
    errors24h: 0,
    lastActivity: "1 hour ago",
    subscriptionStatus: "active",
    subscriptionPlan: "yearly",
  },
];

export default function Branches() {
  const [searchQuery, setSearchQuery] = useState("");
  const [branchData, setBranchData] = useState(branches);

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
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalStudents = branchData.reduce((sum, b) => sum + b.students, 0);
  const totalRevenue = branchData.reduce((sum, b) => sum + b.monthlyRevenue, 0);
  const activeBranches = branchData.filter((b) => b.status === "active").length;

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
        <Button className="gap-2">
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
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Edit Branch</DropdownMenuItem>
                      <DropdownMenuItem>View Logs</DropdownMenuItem>
                      <DropdownMenuItem className="text-status-critical">
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
    </DashboardLayout>
  );
}
