import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
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
import { useNotify } from "@/hooks/use-notify";
import { hasPermission } from "@/lib/auth";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/exportUtils";
import { formatPhoneNumber, toTitleCase } from "@/lib/utils";
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
  const notify = useNotify();

  const getCurrentMonthPaymentStatus = (studentId: string): string => {
    // Use branch's current month, fall back to system month
    const currentMonth = (
      branchData?.currentFinancialMonth?.month || new Date().getMonth() + 1
    )
      .toString()
      .padStart(2, "0");
    const currentYear =
      branchData?.currentFinancialMonth?.year || new Date().getFullYear();

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

      // Run independent requests in parallel
      const [classList, teachersList, branch] = await Promise.all([
        apiListClasses(branchId),
        apiListTeachers(branchId),
        getBranch(branchId),
      ]);

      const classDataFetched = classList.find((c) => c.id === id);

      if (classDataFetched) {
        setClassData(classDataFetched);
        setAllClasses(classList);
        setTeachers(teachersList);
        setBranchData(branch);

        const currentMonth = branch.currentFinancialMonth?.month
          ? String(branch.currentFinancialMonth.month).padStart(2, "0")
          : String(new Date().getMonth() + 1).padStart(2, "0");
        const currentYear = branch.currentFinancialMonth?.year || new Date().getFullYear();

        // Fetch only students in this class + payments in parallel
        const [studentsResponse, paymentsResponse] = await Promise.all([
          apiListStudents(branchId, 1, 300, { classId: classDataFetched.id }),
          apiListPayments({ branchId, month: currentMonth, year: currentYear, limit: 500, page: 1 }),
        ]);

        const classStudentsList = studentsResponse.data || [];
        setStudents(classStudentsList);
        setClassStudents(classStudentsList);

        const paymentsList = Array.isArray(paymentsResponse)
          ? paymentsResponse
          : paymentsResponse?.items || paymentsResponse?.data || [];
        setPayments(paymentsList);

        if (classDataFetched.teacherId) {
          const teacher = teachersList.find(
            (t) => t.id === classDataFetched.teacherId,
          );
          setTeacherName(teacher?.fullName || "Unknown");
        } else {
          setTeacherName(t("noTeacherAssigned"));
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
      notify.error(t("error"), "You don't have permission to update students.");
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: t("removeStudent") || "Remove Student",
      message: t("removeStudentFromClassConfirmation") || "Remove this student from the class?",
      onConfirm: async () => {
        try {
          await apiUpdateStudent(studentId, {
            classId: null as unknown as string,
          });
          await loadData();
          notify.success(t("success"), t("studentRemovedFromClass"));
        } catch (error) {
          console.error("Failed to remove student:", error);
          notify.error(t("error"), t("failedToRemoveStudentFromClass"));
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
      notify.error(t("error"), "Please select students and a target class");
      return;
    }

    if (!canEditStudents) {
      notify.error(t("error"), "You don't have permission to update students.");
      return;
    }

    const targetClass = allClasses.find((c) => c.id === targetClassId);
    if (!targetClass) return;

    const selectedCount = ids.length;

    setConfirmDialog({
      isOpen: true,
      title: t("switchStudents") || "Switch Students",
      message: t("switchConfirmation") || `Switch ${selectedCount} student(s) to ${targetClass.name}?`,
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
          notify.success(t("success"), t("studentsSwitchedSuccess"));
        } catch (error) {
          console.error("Failed to switch students:", error);
          notify.error(t("error"), t("failedToSwitchStudents"));
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
      notify.error(t("error"), "Please select students to delete");
      return;
    }

    if (!canEditStudents) {
      notify.error(t("error"), "You don't have permission to update students.");
      return;
    }

    const selectedCount = ids.length;

    setConfirmDialog({
      isOpen: true,
      title: t("removeStudents") || "Remove Students",
      message: t("removeStudentsConfirmation") || `Remove ${selectedCount} student(s) from this class?`,
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
          notify.success(t("success"), t("studentsRemovedFromClass"));
        } catch (error) {
          console.error("Failed to remove students:", error);
          notify.error(t("error"), t("failedToRemoveStudentsFromClass"));
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
      notify.error(t("error"), "You don't have permission to edit classes.");
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
      notify.error(t("error"), "Class name is required");
      return;
    }

    try {
      await apiUpdateClass(classData.id, {
        name: editFormData.name,
        teacherId: editFormData.teacherId || undefined,
      });

      await loadData();
      setIsEditModalOpen(false);
      notify.success(t("success"), "Class updated successfully");
    } catch (error) {
      console.error("Failed to update class:", error);
      notify.error(t("error"), "Failed to update class");
    }
  };

  const handleDelete = () => {
    if (!canDeleteClasses) {
      notify.error(t("error"), "You don't have permission to delete classes.");
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: t("deleteClass") || "Delete Class",
      message: t("deleteClassConfirmation") || "Are you sure you want to delete this class?",
      onConfirm: async () => {
        try {
          await apiDeleteClass(classData!.id);
          notify.success(t("success"), t("classDeletedSuccessfully"));
          router.push("/classes");
        } catch (error) {
          console.error("Failed to delete class:", error);
          notify.error(t("error"), "Failed to delete class");
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
            <CardHeader className="pb-2">
              <Skeleton className="w-1/3 h-5 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="w-1/4 h-12 rounded" />
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
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
      <PageBreadcrumbs
        items={[
          { label: t("classes"), href: "/classes" },
          { label: classData.name },
        ]}
      />

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/classes")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-display text-slate-900 dark:text-slate-100">
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
            <CardHeader className="pb-2">
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
              <CardHeader className="pb-2">
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
              {t("students")} ({filteredStudents.length < classStudents.length ? `${filteredStudents.length} / ${classStudents.length}` : classStudents.length})
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
                      <InitialsAvatar name={student.fullName} size="md" className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/student-details?id=${student.id}&from=class&classId=${classData.id}`,
                              );
                            }}
                          >
                            {toTitleCase(student.fullName)}
                          </p>
                          <PaymentStatusBadge
                            status={hasCurrentMonthPayment(student.id) ? "paid" : "unpaid"}
                            label={hasCurrentMonthPayment(student.id) ? t("paid") : t("unpaid") || "To'lanmadi"}
                          />
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {formatPhoneNumber(student.phone) || "—"} •{" "}
                          {formatCurrency(student.monthlyPayment)}/
                          {t("month").toLowerCase()}
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
