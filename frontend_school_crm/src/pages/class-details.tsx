import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Class, Student, Teacher } from "@/types";
import {
  ArrowLeft,
  Users,
  Edit2,
  Trash2,
  ArrowRight,
  BookOpen,
  Check,
  Search,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { useToast } from "@/hooks/use-toast";
import { hasPermission } from "@/lib/auth";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/exportUtils";
import {
  listStudents as apiListStudents,
  listClasses as apiListClasses,
  listTeachers as apiListTeachers,
  listPayments as apiListPayments,
  getBranch,
  updateStudent as apiUpdateStudent,
  updateClass as apiUpdateClass,
  deleteClass as apiDeleteClass,
} from "@/lib/api";
import type { Payment } from "@/lib/api";
import type { Branch } from "@/types";
import { searchMatchesCrossScript } from "@/lib/transliterate";

export default function ClassDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [isLoading, setIsLoading] = useState(true);
  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const [teacherName, setTeacherName] = useState("");
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    teacherId: "",
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
    isLoading: false,
  });
  const language = useLanguage();
  const { toast } = useToast();
  const canEditStudents = hasPermission("canEditStudents");
  const canEditClasses = hasPermission("canEditClasses");
  const canDeleteClasses = hasPermission("canDeleteClasses");
  const {
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isSelected,
    getSelectedCount,
    getSelectedIds,
    areAllSelected,
    areSomeSelected,
  } = useMultiSelect<Student>();

  const t = (key: string) => getTranslation(key, language);

  const getCurrentMonthPaymentStatus = (studentId: string): string => {
    // Use branch's current month, not system month
    if (!branchData?.currentFinancialMonth) return "unpaid";

    const currentMonth = branchData.currentFinancialMonth.month
      .toString()
      .padStart(2, "0");
    const currentYear = branchData.currentFinancialMonth.year;

    const student = students.find((s) => s.id === studentId);
    if (!student) return "unpaid";

    // Use backend payments instead of localStorage
    const currentMonthPayments = payments.filter(
      (payment) =>
        payment.studentId === studentId &&
        Number(payment.month) === Number(currentMonth) &&
        Number(payment.year) === currentYear,
    );

    if (currentMonthPayments.length === 0) return "unpaid";

    const paidTotal = currentMonthPayments.reduce(
      (sum, p) => sum + p.amount,
      0,
    );
    const monthly = student.monthlyPayment;

    // If total paid meets or exceeds monthly requirement, it's paid
    if (paidTotal >= monthly) {
      return "paid";
    }

    // If there's any payment but less than required, it's partial
    if (paidTotal > 0) {
      return "partial";
    }

    return "unpaid";
  };

  const hasCurrentMonthPayment = (studentId: string): boolean => {
    return getCurrentMonthPaymentStatus(studentId) === "paid";
  };

  useEffect(() => {
    if (!id) return;

    setIsLoading(true);
    loadData().finally(() => {
      setIsLoading(false);
    });
  }, [id]);

  // Reload data when branch changes
  useEffect(() => {
    const handleBranchChange = () => {
      loadData();
    };
    window.addEventListener("branchChange", handleBranchChange);
    return () => window.removeEventListener("branchChange", handleBranchChange);
  }, []);

  const loadData = async () => {
    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (!branchId) return;

      // Load class from API
      const classList = await apiListClasses(branchId);
      const classDataFetched = classList.find((c) => c.id === id);

      if (classDataFetched) {
        setClassData(classDataFetched);
        setAllClasses(classList);

        // Load students from API (fetch all with large limit)
        const studentsResponse = await apiListStudents(branchId, 1, 10000);
        const allStudents = studentsResponse.data || [];
        setStudents(allStudents);
        const studentsInClass = allStudents.filter(
          (s) => s.classId === classDataFetched.id,
        );
        setClassStudents(studentsInClass);

        // Load teachers from API
        const teachersList = await apiListTeachers(branchId);
        setTeachers(teachersList);

        // Load branch data to get current financial month
        const branch = await getBranch(branchId);
        setBranchData(branch);

        // Load payments from API - fetch all payments without month filter
        // to ensure payment status is calculated correctly across all months
        const paymentsResponse = await apiListPayments({
          branchId,
          limit: 10000,
          page: 1,
        });
        const paymentsList = Array.isArray(paymentsResponse)
          ? paymentsResponse
          : paymentsResponse?.data || [];
        setPayments(paymentsList);

        if (classDataFetched.teacherId) {
          const teacher = teachersList.find(
            (t) => t.id === classDataFetched.teacherId,
          );
          setTeacherName(teacher?.fullName || "Unknown");
        } else {
          setTeacherName("No teacher assigned");
        }
      } else {
        setClassData(null);
      }
    } catch (error) {
      console.error("Failed to load class data:", error);
      setClassData(null);
    }
  };

  const handleRemoveStudent = (studentId: string) => {
    if (!canEditStudents) {
      toast({
        title: t("error"),
        description: "You don't have permission to update students.",
        variant: "destructive",
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Remove Student",
      message:
        t("removeStudentFromClassConfirmation") ||
        "Remove this student from the class?",
      onConfirm: async () => {
        try {
          await apiUpdateStudent(studentId, {
            classId: null as unknown as string,
          });
          await loadData();
          toast({
            title: t("success"),
            description: t("studentRemovedFromClass"),
            variant: "success",
          });
        } catch (error) {
          console.error("Failed to remove student:", error);
          toast({
            title: t("error"),
            description: t("failedToRemoveStudentFromClass"),
            variant: "destructive",
          });
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
      onCancel: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
    });
  };

  const handleSwitchStudents = () => {
    const ids = getSelectedIds();
    if (ids.length === 0 || !targetClassId || !classData) {
      toast({
        title: t("error"),
        description: "Please select students and a target class",
        variant: "destructive",
      });
      return;
    }

    if (!canEditStudents) {
      toast({
        title: t("error"),
        description: "You don't have permission to update students.",
        variant: "destructive",
      });
      return;
    }

    const targetClass = allClasses.find((c) => c.id === targetClassId);
    if (!targetClass) return;

    const selectedCount = ids.length;

    setConfirmDialog({
      isOpen: true,
      title: "Switch Students",
      message:
        t("switchConfirmation") ||
        `Switch ${selectedCount} student(s) to ${targetClass.name}?`,
      onConfirm: async () => {
        try {
          setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
          await Promise.all(
            ids.map((studentId) =>
              apiUpdateStudent(studentId, { classId: targetClassId })
            )
          );
          clearSelection();
          setTargetClassId("");
          await loadData();
          toast({
            title: t("success"),
            description: t("studentsSwitchedSuccess"),
            variant: "success",
          });
        } catch (error) {
          console.error("Failed to switch students:", error);
          toast({
            title: t("error"),
            description: t("failedToSwitchStudents"),
            variant: "destructive",
          });
        } finally {
          setConfirmDialog({ ...confirmDialog, isOpen: false, isLoading: false });
        }
      },
      onCancel: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
    });
  };

  const handleDeleteMultipleStudents = () => {
    const ids = getSelectedIds();
    if (ids.length === 0) {
      toast({
        title: t("error"),
        description: "Please select students to delete",
        variant: "destructive",
      });
      return;
    }

    if (!canEditStudents) {
      toast({
        title: t("error"),
        description: "You don't have permission to update students.",
        variant: "destructive",
      });
      return;
    }

    const selectedCount = ids.length;

    setConfirmDialog({
      isOpen: true,
      title: "Remove Students",
      message: `Remove ${selectedCount} student(s) from this class?`,
      onConfirm: async () => {
        try {
          await Promise.all(
            ids.map((studentId) =>
              apiUpdateStudent(studentId, {
                classId: null as unknown as string,
              })
            )
          );
          clearSelection();
          await loadData();
          toast({
            title: t("success"),
            description: t("studentsRemovedFromClass"),
            variant: "success",
          });
        } catch (error) {
          console.error("Failed to remove students:", error);
          toast({
            title: t("error"),
            description: t("failedToRemoveStudentsFromClass"),
            variant: "destructive",
          });
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
      onCancel: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
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

  if (!classData) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">
          {t("classNotFound") || "Class not found"}
        </p>
        <Button
          variant="outline"
          onClick={() => router.push("/classes")}
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("backToClasses") || "Back to Classes"}
        </Button>
      </div>
    );
  }

  const otherClasses = allClasses.filter((c) => c.id !== classData.id);

  const filteredStudents = classStudents.filter(
    (student) =>
      searchMatchesCrossScript(student.fullName, searchTerm) ||
      student.phone.includes(searchTerm),
  );

  const handleEdit = () => {
    if (!canEditClasses) {
      toast({
        title: t("error"),
        description: "You don't have permission to edit classes.",
        variant: "destructive",
      });
      return;
    }
    if (classData) {
      setEditFormData({
        name: classData.name,
        teacherId: classData.teacherId || "",
      });
      setIsEditModalOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!classData || !editFormData.name.trim()) {
      toast({
        title: t("error"),
        description: "Class name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiUpdateClass(classData.id, {
        name: editFormData.name,
        teacherId: editFormData.teacherId || undefined,
      });

      await loadData();
      setIsEditModalOpen(false);
      toast({
        title: t("success"),
        description: "Class updated successfully",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to update class:", error);
      toast({
        title: t("error"),
        description: "Failed to update class",
        variant: "destructive",
      });
    }
  };

  const handleDelete = () => {
    if (!canDeleteClasses) {
      toast({
        title: t("error"),
        description: "You don't have permission to delete classes.",
        variant: "destructive",
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Delete Class",
      message:
        t("deleteClassConfirmation") ||
        "Are you sure you want to delete this class?",
      onConfirm: async () => {
        try {
          await apiDeleteClass(classData!.id);
          toast({
            title: t("success"),
            description:
              t("classDeletedSuccessfully") || "Class deleted successfully",
            variant: "success",
          });
          router.push("/classes");
        } catch (error) {
          console.error("Failed to delete class:", error);
          toast({
            title: t("error"),
            description: "Failed to delete class",
            variant: "destructive",
          });
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      },
      onCancel: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded" />
          <div className="flex-1">
            <Skeleton className="w-1/3 h-10 rounded" />
            <Skeleton className="w-1/4 h-5 rounded mt-2" />
          </div>
        </div>

        {/* Info Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <Skeleton className="w-1/3 h-6 rounded" />
                <div className="flex gap-2">
                  <Skeleton className="w-20 h-9 rounded" />
                  <Skeleton className="w-20 h-9 rounded" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Skeleton className="w-1/4 h-4 rounded mb-2" />
                <Skeleton className="w-1/2 h-6 rounded" />
              </div>
              <div>
                <Skeleton className="w-1/4 h-4 rounded mb-2" />
                <Skeleton className="w-1/2 h-6 rounded" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="w-1/3 h-6 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="w-1/2 h-10 rounded" />
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <Skeleton className="w-1/3 h-5 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="w-1/4 h-12 rounded" />
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <Skeleton className="w-1/3 h-5 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="w-1/4 h-12 rounded" />
            </CardContent>
          </Card>
        </div>

        {/* Students List Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Skeleton className="w-1/4 h-6 rounded" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="w-full h-16 rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/classes")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {classData.name}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t("classDetails")}
          </p>
        </div>
      </div>

      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                {t("basicInformation")}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canEditStudents}
                  onClick={handleEdit}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  {t("edit")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!canDeleteClasses}
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("delete")}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("className")}
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {classData.name}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("classTeacher")}
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {teacherName}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t("studentCount")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {classStudents.length}
              </div>
            </CardContent>
          </Card>

          {classStudents.length > 0 && (
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {t("paid")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {
                    classStudents.filter((s) => hasCurrentMonthPayment(s.id))
                      .length
                  }
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Switch Students Action Panel */}
      <Card
        className={`border-l-4 transition-all ${
          getSelectedCount() > 0
            ? "border-l-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-l-slate-300 dark:border-l-slate-600 bg-slate-50 dark:bg-slate-900/50 opacity-50"
        }`}
      >
        <CardContent className="py-3 px-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium">
              {getSelectedCount()} {t("itemsSelected") || "selected"}
            </p>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={targetClassId}
                onValueChange={setTargetClassId}
                disabled={getSelectedCount() === 0}
              >
                <SelectTrigger className="w-auto min-w-[150px]">
                  <SelectValue placeholder={t("chooseClass") || "Class"} />
                </SelectTrigger>
                <SelectContent>
                  {otherClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleSwitchStudents}
                disabled={
                  getSelectedCount() === 0 || !targetClassId || !canEditStudents
                }
                className="whitespace-nowrap"
              >
                <ArrowRight className="w-4 h-4 mr-1" />
                {t("switch") || "Switch"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteMultipleStudents}
                disabled={getSelectedCount() === 0 || !canEditStudents}
                className="whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {t("remove")} ({getSelectedCount()})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={clearSelection}
                disabled={getSelectedCount() === 0}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students in Class */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t("students")} ({classStudents.length})
            </CardTitle>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t("searchStudents") || "Search by name or phone"}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {classStudents.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                <Checkbox
                  checked={
                    areAllSelected(filteredStudents) ||
                    areSomeSelected(filteredStudents)
                  }
                  onCheckedChange={() => toggleSelectAll(filteredStudents)}
                />
                <label className="text-sm font-medium cursor-pointer flex-1">
                  {t("selectAll") || "Select All"} ({filteredStudents.length})
                </label>
              </div>

              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all ${
                      isSelected(student.id)
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={isSelected(student.id)}
                        onCheckedChange={() => toggleSelect(student.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className="font-medium text-slate-900 dark:text-slate-100 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/student-details?id=${student.id}&from=class&classId=${classData.id}`,
                              );
                            }}
                          >
                            {student.fullName}
                          </p>
                          {hasCurrentMonthPayment(student.id) && (
                            <div className="flex items-center gap-1">
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <span className="text-xs text-green-600 dark:text-green-400">
                                {t("paid")}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {student.phone} •{" "}
                          {formatCurrency(student.monthlyPayment)}/
                          {t("month") || "month"}
                        </p>
                        <Badge className="mt-2">{t(student.status)}</Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveStudent(student.id);
                      }}
                      disabled={!canEditStudents}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 dark:text-slate-400">
                    {t("noStudentsFound")}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">
                {t("noStudentsAssigned")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Class Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editClass") || "Edit Class"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="className">{t("className")} *</Label>
              <Input
                id="className"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
                placeholder={t("classNamePlaceholder") || "e.g., 7A, Grade 9B"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacherId">
                {t("classTeacher") || "Class Teacher"}
              </Label>
              <Select
                value={editFormData.teacherId || "none"}
                onValueChange={(value) =>
                  setEditFormData({
                    ...editFormData,
                    teacherId: value === "none" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("selectTeacherOptional") || "Select teacher"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("noTeacherAssigned") || "No teacher assigned"}
                  </SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.fullName} - {teacher.subjects.join(", ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleSaveEdit}>{t("save") || "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Confirmation Dialog */}
      <Dialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 dark:text-slate-400">
              {confirmDialog.message}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                confirmDialog.onCancel();
              }}
              disabled={confirmDialog.isLoading}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={() => {
                confirmDialog.onConfirm();
              }}
              disabled={confirmDialog.isLoading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {confirmDialog.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("loading")}
                </>
              ) : (
                t("confirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
