import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { studentsDB, classesDB, paymentsDB } from "@/lib/storage";
import { Student, Payment, Branch } from "@/types";
import {
  ArrowLeft,
  Phone,
  Users,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  UserX,
  Loader2,
} from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";
import { hasPermission, getCurrentUser } from "@/lib/auth";
import { formatPhoneNumber, toTitleCase, formatDate } from "@/lib/utils";
import { getStudent, listPayments, listClasses, getStudentPaymentHistory, getBranch } from "@/lib/api";

export default function StudentDetailsPage() {
  const router = useRouter();
  const { id, from } = router.query;
  const [isLoading, setIsLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [className, setClassName] = useState("");
  const [backRoute, setBackRoute] = useState<string>("/students");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [markLeftConfirmOpen, setMarkLeftConfirmOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isMarkLeftLoading, setIsMarkLeftLoading] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    classId: "",
    phone: "",
    parentPhone: "",
    status: "active" as Student["status"],
    monthlyPayment: "",
  });
  const language = useLanguage();
  const { toast } = useToast();
  const canEditStudents = hasPermission("canEditStudents");
  const canDeleteStudents = hasPermission("canDeleteStudents");
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "branch_admin";

  useEffect(() => {
    if (!id) return;

    setIsLoading(true);
    loadData().finally(() => {
      setIsLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (from === "class") {
      const classId = router.query.classId;
      if (classId) {
        setBackRoute(`/class-details?id=${classId}`);
      }
    } else {
      setBackRoute("/students");
    }
  }, [from, router.query.classId]);

  // Reload data when branch changes
  useEffect(() => {
    const handleBranchChange = () => {
      loadData();
    };
    window.addEventListener("branchChange", handleBranchChange);
    return () => window.removeEventListener("branchChange", handleBranchChange);
  }, []);

  const t = (key: string) => getTranslation(key, language);

  const loadData = async () => {
    try {
      // Check if id is available before making API call
      if (!id) return;
      
      // Fetch student data from backend
      const studentData = await getStudent(id as string);
      if (studentData) {
        setStudent(studentData);
        
        // Fetch class name from backend API
        try {
          const branchId = localStorage.getItem("selectedBranchId");
          if (branchId && studentData.classId) {
            const classesData = await listClasses(branchId);
            const classData = classesData.find((c: any) => c.id === studentData.classId);
            setClassName(classData?.name || "—");
          }
        } catch (error) {
          console.error("Failed to fetch class name:", error);
          setClassName("—");
        }
        
        const branchId = localStorage.getItem("selectedBranchId");
        
        // Fetch branch data for current month info
        if (branchId) {
          const branch = await getBranch(branchId);
          setBranchData(branch);
        }
        
        // Fetch payments based on role
        // Admin sees all payment history, Manager sees only current month
        if (isAdmin) {
          // Admin: get full payment history
          const paymentsData = await getStudentPaymentHistory(studentData.id, branchId || undefined);
          setPayments(paymentsData);
        } else {
          // Manager: get all payments (no limit) for this student
          if (branchId) {
            const paymentsResponse = await listPayments({ branchId, limit: 10000 });
            const paymentsData = Array.isArray(paymentsResponse) 
              ? paymentsResponse 
              : paymentsResponse?.data || [];
            // Filter payments for this student
            const studentPayments = paymentsData.filter((p: Payment) => p.studentId === studentData.id);
            setPayments(studentPayments);
          }
        }
      }
      
      // Load classes for edit form
      const branchId = localStorage.getItem("selectedBranchId");
      if (branchId) {
        const classesData = await listClasses(branchId);
        setClasses(classesData);
      }
    } catch (error) {
      console.error("Failed to load student details:", error);
      toast({
        title: t("error"),
        description: t("failedToLoadStudentDetails"),
        variant: "destructive",
      });
      setStudent(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "left":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      case "suspended":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "partial":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "";
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      paid: "paid",
      partial: "partial",
    };
    return t(statusMap[status] || status) || status;
  };

  // Calculate effective status based on actual payment amount vs monthly payment
  const getEffectivePaymentStatus = (payment: any): string => {
    if (!student) return payment.status;
    
    // If payment amount >= monthly payment, it's fully paid
    if (payment.amount >= student.monthlyPayment) {
      return "paid";
    }
    // If payment amount < monthly payment, it's partial
    return "partial";
  };

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Outstanding = total due (months active × monthly fee) minus total paid
  const totalPending = (() => {
    if (!student) return 0;
    const enrollDate = student.enrollmentDate ? new Date(student.enrollmentDate) : new Date();
    const now = new Date();
    const monthsActive = Math.max(
      1,
      (now.getFullYear() - enrollDate.getFullYear()) * 12 +
        (now.getMonth() - enrollDate.getMonth()) +
        1,
    );
    const totalDue = (student.monthlyPayment || 0) * monthsActive;
    return Math.max(0, totalDue - totalPaid);
  })();

  const handleEdit = () => {
    if (student) {
      setEditFormData({
        fullName: student.fullName,
        classId: student.classId,
        phone: student.phone,
        parentPhone: student.parentPhone,
        status: student.status,
        monthlyPayment: student.monthlyPayment?.toString() || "",
      });
      setEditDialogOpen(true);
    }
  };

  const handleSaveEdit = () => {
    if (!student || !editFormData.fullName || !editFormData.classId) {
      toast({
        title: t("error"),
        description: t("fillRequiredFields"),
        variant: "destructive",
      });
      return;
    }

    const updatedMonthlyPayment = parseInt(editFormData.monthlyPayment) || student.monthlyPayment;

    studentsDB.update(student.id, {
      fullName: editFormData.fullName,
      classId: editFormData.classId,
      phone: editFormData.phone,
      parentPhone: editFormData.parentPhone,
      status: editFormData.status,
      monthlyPayment: updatedMonthlyPayment,
    });

    setStudent({
      ...student,
      fullName: editFormData.fullName,
      classId: editFormData.classId,
      phone: editFormData.phone,
      parentPhone: editFormData.parentPhone,
      status: editFormData.status,
      monthlyPayment: updatedMonthlyPayment,
    });

    const classData = classesDB.getById(editFormData.classId);
    setClassName(classData?.name || "—");

    toast({
      title: t("updated"),
      description: t("studentDetailsUpdated"),
      variant: "success",
    });

    setEditDialogOpen(false);
  };

  const handleDelete = () => {
    if (!canDeleteStudents) {
      toast({
        title: t("permissionDenied"),
        description: t("noPermissionToDeleteStudents"),
        variant: "destructive",
      });
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (student) {
      setIsDeleteLoading(true);
      try {
        studentsDB.delete(student.id);
        toast({
          title: t("deleted"),
          description: t("successfullyDeleted"),
          variant: "success",
        });
        router.push(backRoute);
      } catch (error) {
        toast({
          title: t("error"),
          description: t("failedToDeleteStudent"),
          variant: "destructive",
        });
      } finally {
        setIsDeleteLoading(false);
        setDeleteConfirmOpen(false);
      }
    }
  };

  const handleMarkLeft = () => {
    if (!canEditStudents) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to edit students.",
        variant: "destructive",
      });
      return;
    }
    setMarkLeftConfirmOpen(true);
  };

  const confirmMarkLeft = async () => {
    if (student && student.status !== "left") {
      setIsMarkLeftLoading(true);
      try {
        const updatedStudent = {
          ...student,
          status: "left" as const,
          leftDate: new Date().toISOString(),
        };
        studentsDB.update(student.id, {
          status: "left",
          leftDate: new Date().toISOString(),
        });
        setStudent(updatedStudent);
        toast({
          title: t("updated"),
          description: t("statusUpdated"),
          variant: "success",
        });
      } catch (error) {
        toast({
          title: t("error"),
          description: "Failed to update student status",
          variant: "destructive",
        });
      } finally {
        setIsMarkLeftLoading(false);
        setMarkLeftConfirmOpen(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded" />
            <div className="flex-1">
              <Skeleton className="w-48 h-8 rounded mb-2" />
              <Skeleton className="w-32 h-4 rounded" />
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Skeleton className="flex-1 sm:flex-none h-10 w-24 rounded" />
            <Skeleton className="flex-1 sm:flex-none h-10 w-24 rounded" />
          </div>
        </div>

        {/* Info Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="w-1/3 h-6 rounded" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <Skeleton className="w-1/4 h-4 rounded mb-2" />
                  <Skeleton className="w-3/4 h-5 rounded" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="w-1/3 h-6 rounded" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <Skeleton className="w-1/4 h-4 rounded mb-2" />
                  <Skeleton className="w-1/2 h-5 rounded" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Payment History Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="w-1/3 h-6 rounded" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="w-full h-16 rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">
          {t("noStudentsYet")}
        </p>
        <Button onClick={() => router.push(backRoute)} className="mt-4">
          {t("backToStudents")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(backRoute)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                {toTitleCase(student.fullName)}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                {t("studentDetails")}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {canEditStudents && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  {t("edit")}
                </Button>
                {student.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkLeft}
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    {t("left")}
                  </Button>
                )}
              </>
            )}
            {canDeleteStudents && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t("delete")}
              </Button>
            )}
          </div>
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t("basicInformation")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("fullName")}
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {student.fullName}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("class")}
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {className}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("status")}
                </p>
                <Badge className={`${getStatusColor(student.status)} mt-2`}>
                  {t(student.status)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                {t("contact")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("phone")}
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatPhoneNumber(student.phone)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("parentPhone")}
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatPhoneNumber(student.parentPhone)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                {t("monthlyPayment")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(student.monthlyPayment)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {t("totalPaid")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(totalPaid)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t("pendingLabel")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(totalPending)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enrollment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t("enrollmentInformation")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("enrollmentDate")}
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatDate(student.enrollmentDate)}
              </p>
            </div>
            {student.leftDate && (
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("leftDate")}
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatDate(student.leftDate)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle>{t("paymentHistory")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("period")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("amount")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("status")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("paidDate")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length > 0 ? (
                    payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                      >
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {payment.month} {payment.year}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={getPaymentStatusColor(getEffectivePaymentStatus(payment))}
                          >
                            {getPaymentStatusLabel(getEffectivePaymentStatus(payment))}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {payment.paidDate
                            ? new Date(payment.paidDate).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              }).replace(/\//g, ".")
                            : "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-slate-500"
                      >
                        {t("noPayments")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Student Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("editStudent")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-fullName">{t("fullName")} *</Label>
                <Input
                  id="edit-fullName"
                  value={editFormData.fullName}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, fullName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-classId">{t("selectClass")} *</Label>
                <Select
                  value={editFormData.classId}
                  onValueChange={(value) =>
                    setEditFormData({ ...editFormData, classId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectClass")} />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">{t("phone")} *</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-parentPhone">{t("parentPhone")} *</Label>
                <Input
                  id="edit-parentPhone"
                  type="tel"
                  value={editFormData.parentPhone}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      parentPhone: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">{t("status")} *</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value: Student["status"]) =>
                    setEditFormData({ ...editFormData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("active")}</SelectItem>
                    <SelectItem value="suspended">{t("suspended")}</SelectItem>
                    <SelectItem value="left">{t("left")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-monthlyPayment">{t("monthlyPayment")} *</Label>
                <Input
                  id="edit-monthlyPayment"
                  type="number"
                  min="0"
                  step="500"
                  value={editFormData.monthlyPayment}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, monthlyPayment: e.target.value })
                  }
                  placeholder="0"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button onClick={handleSaveEdit}>
                  {t("update")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("confirmDelete")}</DialogTitle>
            </DialogHeader>
            <p className="text-slate-600 dark:text-slate-400">
              {t("confirmDeleteStudent")}
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isDeleteLoading}
              >
                {t("cancel")}
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDelete}
                disabled={isDeleteLoading}
              >
                {isDeleteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("deleting")}
                  </>
                ) : (
                  t("delete")
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Mark Left Confirmation Dialog */}
        <Dialog
          open={markLeftConfirmOpen}
          onOpenChange={setMarkLeftConfirmOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("confirm")}</DialogTitle>
            </DialogHeader>
            <p className="text-slate-600 dark:text-slate-400">
              {t("confirmMarkLeft")}
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {t("willStopPaymentTracking")}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setMarkLeftConfirmOpen(false)}
                disabled={isMarkLeftLoading}
              >
                {t("cancel")}
              </Button>
              <Button 
                onClick={confirmMarkLeft}
                disabled={isMarkLeftLoading}
              >
                {isMarkLeftLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("updating")}
                  </>
                ) : (
                  t("confirm")
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    
  );
}
