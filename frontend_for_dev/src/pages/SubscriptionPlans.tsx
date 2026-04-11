import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  MoreVertical,
  DollarSign,
  Layers,
  Users,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  getAllSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getUserSubscriptions,
  createUserSubscription,
  updateUserSubscription,
  deleteUserSubscription,
  getAllUsers,
  type SubscriptionPlan as SubscriptionPlanType,
  type UserSubscription as UserSubscriptionType,
} from "@/services/subscription-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface User {
  id: string;
  fullName: string;
  email: string;
}

export default function SubscriptionPlans() {
  const [activeTab, setActiveTab] = useState("plans");
  const [plans, setPlans] = useState<SubscriptionPlanType[]>([]);
  const [subscriptions, setSubscriptions] = useState<UserSubscriptionType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isDeletePlanOpen, setIsDeletePlanOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isDeleteSubOpen, setIsDeleteSubOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanType | null>(null);
  const [editingSub, setEditingSub] = useState<UserSubscriptionType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [planForm, setPlanForm] = useState({
    name: "",
    description: "",
    price: 0,
    billingPeriod: "monthly" as const,
    maxBranches: 1,
    maxStudents: 100,
    maxClasses: 5,
    status: "active" as "active" | "inactive",
  });

  const [subForm, setSubForm] = useState({
    userId: "",
    planId: "",
    autoRenew: true,
    paymentMethod: "credit_card",
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [plansData, subscriptionsData, usersData] = await Promise.all([
        getAllSubscriptionPlans(),
        getUserSubscriptions(),
        getAllUsers(),
      ]);
      setPlans(plansData);
      setSubscriptions(subscriptionsData);
      setUsers(usersData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load data";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlans = plans.filter((plan) =>
    plan.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    return matchesStatus;
  });

  // Plan functions
  const handleAddPlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: "",
      description: "",
      price: 0,
      billingPeriod: "monthly",
      maxBranches: 1,
      maxStudents: 100,
      maxClasses: 5,
      status: "active",
    });
    setIsPlanModalOpen(true);
  };

  const handleEditPlan = (plan: SubscriptionPlanType) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description ?? "",
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      maxBranches: plan.maxBranches ?? 1,
      maxStudents: plan.maxStudents ?? 100,
      maxClasses: plan.maxClasses ?? 5,
      status: plan.status,
    });
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name || planForm.price < 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      if (editingPlan) {
        await updateSubscriptionPlan(editingPlan.id, planForm);
        toast.success("Plan updated successfully");
      } else {
        await createSubscriptionPlan(planForm);
        toast.success("Plan created successfully");
      }
      await loadData();
      setIsPlanModalOpen(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save plan";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!editingPlan) return;
    setIsDeleting(true);
    try {
      await deleteSubscriptionPlan(editingPlan.id);
      toast.success("Plan deleted successfully");
      await loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete plan";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
      setIsDeletePlanOpen(false);
    }
  };

  // Subscription functions
  const handleAddSubscription = () => {
    setEditingSub(null);
    setSubForm({
      userId: "",
      planId: "",
      autoRenew: true,
      paymentMethod: "credit_card",
    });
    setIsSubscriptionModalOpen(true);
  };

  const handleEditSubscription = (sub: UserSubscriptionType) => {
    setEditingSub(sub);
    setSubForm({
      userId: sub.userId,
      planId: sub.planId,
      autoRenew: sub.autoRenew,
      paymentMethod: sub.paymentMethod || "credit_card",
    });
    setIsSubscriptionModalOpen(true);
  };

  const handleSaveSubscription = async () => {
    if (!subForm.userId || !subForm.planId) {
      toast.error("Please select both user and plan");
      return;
    }

    setIsSaving(true);
    try {
      if (editingSub) {
        await updateUserSubscription(editingSub.id, {
          planId: subForm.planId,
          autoRenew: subForm.autoRenew,
          paymentMethod: subForm.paymentMethod,
        });
        toast.success("Subscription updated successfully");
      } else {
        await createUserSubscription({
          userId: subForm.userId,
          planId: subForm.planId,
          autoRenew: subForm.autoRenew,
          paymentMethod: subForm.paymentMethod,
        });
        toast.success("Subscription created successfully");
      }
      await loadData();
      setIsSubscriptionModalOpen(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save subscription";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubscription = async () => {
    if (!editingSub) return;
    setIsDeleting(true);
    try {
      await deleteUserSubscription(editingSub.id);
      toast.success("Subscription deleted successfully");
      await loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete subscription";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
      setIsDeleteSubOpen(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("uz-UZ", {
      style: "currency",
      currency: "UZS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading subscription data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Subscriptions</h1>
            <p className="text-muted-foreground mt-2">
              Manage subscription plans and user subscriptions
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg">
            <p className="font-semibold">Error loading data</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="plans" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Subscription Plans
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              User Subscriptions
            </TabsTrigger>
          </TabsList>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-md">
                <Input
                  placeholder="Search plans..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button onClick={handleAddPlan} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Plan
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-lg">
                        {plan.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditPlan(plan)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setEditingPlan(plan);
                            setIsDeletePlanOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-3">
                    <div className="text-2xl font-bold text-foreground">
                      {formatCurrency(plan.price)}
                      <span className="text-sm text-muted-foreground ml-2">
                        /{plan.billingPeriod}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Branches</p>
                        <p className="font-medium text-foreground">
                          {plan.maxBranches}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Students</p>
                        <p className="font-medium text-foreground">
                          {plan.maxStudents}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Classes</p>
                        <p className="font-medium text-foreground">
                          {plan.maxClasses}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-medium text-foreground capitalize">
                          {plan.status}
                        </p>
                      </div>
                    </div>

                    {plan.features && Object.keys(plan.features).length > 0 && (
                      <div className="pt-3 border-t space-y-1">
                        {Object.entries(plan.features || {}).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center gap-2 text-sm"
                          >
                            {value ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className="text-muted-foreground">
                              {key.replace(/_/g, " ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* User Subscriptions Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2 flex-1 max-w-md">
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddSubscription} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Subscription
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Plan
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Renewal
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b hover:bg-muted/30">
                       <td className="px-4 py-3">
                         <div>
                           <p className="font-medium text-foreground font-mono text-xs">
                             {sub.userId.slice(0, 8)}...
                           </p>
                           <p className="text-sm text-muted-foreground">
                             User ID
                           </p>
                         </div>
                       </td>
                       <td className="px-4 py-3 text-foreground font-mono text-xs">
                         {sub.planId.slice(0, 8)}...
                       </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            sub.status === "active"
                              ? "bg-green-100 text-green-800"
                              : sub.status === "cancelled"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          )}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground text-sm">
                        {sub.startDate}
                      </td>
                      <td className="px-4 py-3 text-foreground text-sm">
                        {sub.renewalDate || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEditSubscription(sub)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setEditingSub(sub);
                                setIsDeleteSubOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Plan Modal */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Edit Plan" : "Add New Plan"}
            </DialogTitle>
            <DialogDescription>
              {editingPlan
                ? "Update subscription plan details"
                : "Create a new subscription plan"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name *</Label>
              <Input
                id="name"
                value={planForm.name}
                onChange={(e) =>
                  setPlanForm({ ...planForm, name: e.target.value })
                }
                placeholder="e.g., Professional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={planForm.description}
                onChange={(e) =>
                  setPlanForm({ ...planForm, description: e.target.value })
                }
                placeholder="Plan description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={planForm.price}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      price: parseFloat(e.target.value),
                    })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Billing Period</Label>
                <Select
                  value={planForm.billingPeriod}
                  onValueChange={(val) =>
                    setPlanForm({
                      ...planForm,
                      billingPeriod: val as "monthly" | "yearly",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branches">Max Branches</Label>
                <Input
                  id="branches"
                  type="number"
                  value={planForm.maxBranches}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      maxBranches: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="students">Max Students</Label>
                <Input
                  id="students"
                  type="number"
                  value={planForm.maxStudents}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      maxStudents: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="classes">Max Classes</Label>
                <Input
                  id="classes"
                  type="number"
                  value={planForm.maxClasses}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      maxClasses: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={planForm.status}
                onValueChange={(val) =>
                  setPlanForm({
                    ...planForm,
                    status: val as "active" | "inactive",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPlanModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePlan} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingPlan ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Plan Dialog */}
      <AlertDialog open={isDeletePlanOpen} onOpenChange={setIsDeletePlanOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{editingPlan?.name}" plan?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlan}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subscription Modal */}
      <Dialog
        open={isSubscriptionModalOpen}
        onOpenChange={setIsSubscriptionModalOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSub ? "Edit Subscription" : "Add User Subscription"}
            </DialogTitle>
            <DialogDescription>
              {editingSub
                ? "Update subscription details"
                : "Create a new user subscription"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user">User *</Label>
              <Select
                value={subForm.userId}
                onValueChange={(val) =>
                  setSubForm({ ...subForm, userId: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.length > 0 ? (
                    users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName} ({user.email})
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No users available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Subscription Plan *</Label>
              <Select
                value={subForm.planId}
                onValueChange={(val) =>
                  setSubForm({ ...subForm, planId: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({formatCurrency(plan.price)}/
                      {plan.billingPeriod})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment">Payment Method</Label>
              <Select
                value={subForm.paymentMethod}
                onValueChange={(val) =>
                  setSubForm({ ...subForm, paymentMethod: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="autorenew">Auto Renew</Label>
              <input
                id="autorenew"
                type="checkbox"
                checked={subForm.autoRenew}
                onChange={(e) =>
                  setSubForm({ ...subForm, autoRenew: e.target.checked })
                }
                className="h-4 w-4"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSubscriptionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSubscription} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingSub ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subscription Dialog */}
      <AlertDialog open={isDeleteSubOpen} onOpenChange={setIsDeleteSubOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this subscription? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubscription}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
