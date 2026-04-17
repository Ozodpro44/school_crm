import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Student, StudentStatus } from "@/types";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  UserX,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import {
  createStudent as apiCreateStudent,
  updateStudent as apiUpdateStudent,
  deleteStudent as apiDeleteStudent,
  createClass as apiCreateClass,
} from "@/lib/api";
import {
  useStudentsConsolidatedQuery,
  useClassesQuery,
  useBranchQuery,
} from "@/hooks/queries";
import { useBranch } from "@/context/BranchContext";
import { Branch } from "@/types";
import type { Student as ApiStudent } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { formatNumberWithSpaces, removeNumberFormatting, formatPhoneNumber, isValidUzbekPhone, toTitleCase, formatDate } from "@/lib/utils";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { useSettings } from "@/hooks/use-settings";
import { searchMatchesCrossScript } from "@/lib/transliterate";
import { PageHeader } from "@/components/PageHeader";

export default function StudentsPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const { currentBranch } = useBranch();
  const branchId = currentBranch?.id || null;
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [importData, setImportData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkChangeClassOpen, setIsBulkChangeClassOpen] = useState(false);
  const [bulkChangeClassId, setBulkChangeClassId] = useState<string>("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [isBulkDeleteLoading, setIsBulkDeleteLoading] = useState(false);
  const [markLeftConfirmOpen, setMarkLeftConfirmOpen] = useState(false);
  const [markLeftStudentId, setMarkLeftStudentId] = useState<string | null>(null);
  const [isMarkLeftLoading, setIsMarkLeftLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const itemsPerPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Branch data for financial month
  const { data: branchData } = useBranchQuery(branchId);
  const currentMonth =
    branchData?.currentFinancialMonth?.month?.toString().padStart(2, "0") ||
    String(new Date().getMonth() + 1).padStart(2, "0");
  const currentYear = (branchData?.currentFinancialMonth?.year || new Date().getFullYear()).toString();

  // Build filters object (stable reference when values don't change)
  const queryFilters = useMemo(
    () => ({
      search: searchTerm || undefined,
      classId: filterClass !== "all" ? filterClass : undefined,
      status: filterStatus !== "all" ? filterStatus : undefined,
      paymentStatus: filterPaymentStatus !== "all" ? filterPaymentStatus : undefined,
      month: currentMonth,
      year: currentYear,
    }),
    [searchTerm, filterClass, filterStatus, filterPaymentStatus, currentMonth, currentYear]
  );

  const {
    data: studentsData,
    isLoading,
    isFetching: isListLoading,
  } = useStudentsConsolidatedQuery(branchId, page, limit, queryFilters, {
    refetchOnWindowFocus: true,
  });

  const { data: classesData } = useClassesQuery(branchId);

  const students: Student[] = studentsData?.items || studentsData?.data || [];
  const total: number = studentsData?.total || 0;
  const totalPages: number = Math.ceil(total / limit);
  const classes: any[] = classesData || studentsData?.classes || [];
  const language = useLanguage();
  const { toast } = useToast();
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

  const [formData, setFormData] = useState({
    fullName: "",
    classId: "",
    phone: "",
    parentPhone: "",
    monthlyPayment: "",
    status: "active" as StudentStatus,
  });
  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    phone?: string;
    parentPhone?: string;
    monthlyPayment?: string;
  }>({});

  const clearFieldError = (field: keyof typeof formErrors) => {
    if (formErrors[field]) setFormErrors((e) => ({ ...e, [field]: undefined }));
  };

  const t = (key: string) => getTranslation(key, language);

  // Get permissions once per component lifecycle
  const canCreateStudents = useMemo(() => hasPermission("canCreateStudents"), []);
  const canEditStudents = useMemo(() => hasPermission("canEditStudents"), []);
  const canDeleteStudents = useMemo(() => hasPermission("canDeleteStudents"), []);

  // Initialize state from URL params (React Query auto-fires when state changes)
  useEffect(() => {
    if (!router.isReady) return;
    const { page: qPage, limit: qLimit, search: qSearch, status: qStatus, classId: qClassId, paymentStatus: qPaymentStatus } = router.query;
    if (qPage) setPage(parseInt(qPage as string) || 1);
    if (qLimit) setLimit(parseInt(qLimit as string) || 10);
    const initSearch = (qSearch as string) || "";
    setSearchTerm(initSearch);
    setSearchInput(initSearch);
    setFilterStatus((qStatus as string) || "all");
    setFilterClass((qClassId as string) || "all");
    setFilterPaymentStatus((qPaymentStatus as string) || "all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Sync URL params when filters/page change (shallow push, no data refetch needed)
  useEffect(() => {
    if (!router.isReady) return;
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterClass !== "all") params.set("classId", filterClass);
    if (filterPaymentStatus !== "all") params.set("paymentStatus", filterPaymentStatus);
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    router.push(`/students?${params.toString()}`, undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterStatus, filterClass, filterPaymentStatus, page, limit]);

  const hasCurrentMonthPayment = (studentId: string): boolean => {
    // Payment data not available with consolidated endpoint
    return false;
  };

  const getCurrentMonthPaymentStatus = (studentId: string): string => {
    // Payment data not available with consolidated endpoint
    return "unpaid";
  };

  const processCSVData = async (csvText: string) => {
    try {
      const lines = csvText.trim().split("\n");
      const defaultPayment = settings?.monthlyPayment || 500000;

      let importedCount = 0;
      const warnings: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = (lines[i] ?? "").trim();
        if (!line) continue;

        const parts = line.split(",").map((p) => p.trim());

        if (parts.length >= 3) {
          const [
            fullName,
            classNameOrPhone,
            phoneOrParent,
            parentPhoneOrPayment,
            monthlyPaymentStr,
          ] = parts as [string, string, string, string | undefined, string | undefined];

          // Try to detect if second column is a class name or phone
          let className = "";
          let phone = "";
          let parentPhone = "";
          let monthlyPayment = defaultPayment;

          // Check if second column looks like a class name:
          // - Contains letters (Latin or Cyrillic) 
          // - OR doesn't look like a phone number (phone numbers are mostly digits)
          const hasLetters = /[a-zA-Zа-яА-ЯёЁ\u0400-\u04FF]/i.test(classNameOrPhone);
          const looksLikePhone = /^[\d\s\+\-\(\)]+$/.test(classNameOrPhone.replace(/\s/g, '')) && classNameOrPhone.replace(/\D/g, '').length >= 7;
          const isClassName = hasLetters || !looksLikePhone;

          if (isClassName) {
            // Format: Full Name, Class, Phone, Parent Phone, Monthly Payment
            className = classNameOrPhone;
            phone = phoneOrParent;
            parentPhone = parentPhoneOrPayment || "";
            monthlyPayment =
              monthlyPaymentStr && !isNaN(parseFloat(monthlyPaymentStr))
                ? parseFloat(monthlyPaymentStr)
                : defaultPayment;
          } else {
            // Format: Full Name, Phone, Parent Phone, Monthly Payment (class omitted)
            phone = classNameOrPhone;
            parentPhone = phoneOrParent;
            monthlyPayment =
              parentPhoneOrPayment && !isNaN(parseFloat(parentPhoneOrPayment))
                ? parseFloat(parentPhoneOrPayment)
                : defaultPayment;
          }

          let classId = "";
          if (className) {
            const classObj = classes.find(
              (c) => c.name.toLowerCase() === className.toLowerCase()
            );

            if (!classObj) {
              // Try to create the class
              try {
                const newClass = await apiCreateClass({
                  name: className,
                  branchId: branchId || "",
                });
                classId = newClass.id;
                // Add to classes list so future students in this import can use it
                classes.push(newClass);
              } catch (classError) {
                warnings.push(
                  `Row ${i + 1
                  }: Could not create class "${className}" (student added without class) - ${classError instanceof Error ? classError.message : "Unknown error"
                  }`
                );
              }
            } else {
              classId = classObj.id;
            }
          }

          try {
            await apiCreateStudent({
              fullName,
              classId: classId || undefined,
              phone,
              parentPhone,
              monthlyPayment,
              status: "active",
              enrollmentDate: new Date().toISOString(),
              branchId: branchId || "",
            });
            importedCount++;
          } catch (err) {
            warnings.push(
              `Row ${i + 1}: Failed to import "${fullName}" - ${(err as any)?.message || "Unknown error"}`
            );
          }
        }
      }

      if (importedCount > 0) {
        toast({
          title: t("importComplete"),
          description: `${t("successfullyImported")} ${importedCount} ${t(
            "students"
          )}`,
          variant: "success",
        });
      }

      if (warnings.length > 0) {
        toast({
          title: "Import Completed with Warnings",
          description:
            warnings.slice(0, 3).join("\n") +
            (warnings.length > 3
              ? `\n... and ${warnings.length - 3} more`
              : ""),
          variant: "default",
        });
      }

      setImportData("");
      setIsImportDialogOpen(false);
      setPage(1);
      qc.invalidateQueries({ queryKey: ["students"] });
    } catch (error) {
      toast({
        title: t("importError"),
        description: t("errorCheckFormat"),
        variant: "destructive",
      });
      console.error(error);
    }
  };

  const handleImport = async () => {
    processCSVData(importData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        processCSVData(csvText);
      } catch (error) {
        toast({
          title: t("importError"),
          description: t("failedToReadFile"),
          variant: "destructive",
        });
        console.error(error);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };

    reader.onerror = () => {
      toast({
        title: t("importError"),
        description: t("failedToReadFile"),
        variant: "destructive",
      });
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const template = `Full Name,Class,Phone,Parent Phone,Monthly Payment
John Doe,Class 7A,+998901234567,+998901234568,500000
Jane Smith,Class 8B,+998901234569,+998901234570,550000`;

    // Add BOM for UTF-8 encoding to ensure Excel opens correctly
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Inline validation
    const errors: typeof formErrors = {};
    if (!formData.fullName.trim()) errors.fullName = t("fieldRequired") || "This field is required";
    if (!formData.phone.trim()) {
      errors.phone = t("fieldRequired") || "This field is required";
    } else if (!isValidUzbekPhone(formData.phone)) {
      errors.phone = t("invalidPhone") || "Enter a valid phone: +998 XX XXX-XX-XX";
    }
    if (!formData.parentPhone.trim()) {
      errors.parentPhone = t("fieldRequired") || "This field is required";
    } else if (!isValidUzbekPhone(formData.parentPhone)) {
      errors.parentPhone = t("invalidPhone") || "Enter a valid phone: +998 XX XXX-XX-XX";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    if (!canEditStudents) {
      toast({
        title: t("permissionDenied"),
        description: t("noPermissionToCreateOrEditStudents"),
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const defaultMonthlyPayment = settings?.monthlyPayment || 500000;
    const monthlyPayment =
      parseInt(formData.monthlyPayment) || defaultMonthlyPayment;

    try {
      if (editingStudent) {
        await apiUpdateStudent(editingStudent.id, {
          fullName: formData.fullName,
          classId: formData.classId || undefined,
          phone: formData.phone,
          parentPhone: formData.parentPhone,
          status: formData.status,
          monthlyPayment,
        });
      } else {
        await apiCreateStudent({
          fullName: formData.fullName,
          classId: formData.classId || undefined,
          phone: formData.phone,
          parentPhone: formData.parentPhone,
          status: formData.status,
          monthlyPayment,
          enrollmentDate: new Date().toISOString(),
          branchId: branchId || "",
        });
      }

      resetForm();
      qc.invalidateQueries({ queryKey: ["students"] });
      setIsDialogOpen(false);
      toast({
        title: editingStudent ? t("updated") : t("created"),
        description: editingStudent ? t("studentUpdatedSuccessfully") : t("studentCreatedSuccessfully"),
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to save student:", error);
      toast({
        title: t("error"),
        description: t("failedToSaveStudent"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (student: Student) => {
    if (!canEditStudents) {
      toast({
        title: t("permissionDenied"),
        description: t("noPermissionToEditStudents"),
        variant: "destructive",
      });
      return;
    }

    setEditingStudent(student);
    setFormData({
      fullName: student.fullName,
      classId: student.class?.id || student.classId || "",
      phone: student.phone,
      parentPhone: student.parentPhone,
      monthlyPayment: student.monthlyPayment.toString(),
      status: student.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!canDeleteStudents) {
      toast({
        title: t("permissionDenied"),
        description: t("noPermissionToDeleteStudents"),
        variant: "destructive",
      });
      return;
    }

    setDeleteStudentId(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteStudentId) {
      setIsDeleteLoading(true);
      try {
        await apiDeleteStudent(deleteStudentId);
        qc.invalidateQueries({ queryKey: ["students"] });
        toast({
          title: t("deleted"),
          description: t("successfullyDeleted"),
          variant: "success",
        });
        setDeleteConfirmOpen(false);
        setDeleteStudentId(null);
      } catch (error) {
        console.error("Failed to delete student:", error);
        toast({
          title: t("error"),
          description: t("failedToDeleteStudent"),
          variant: "destructive",
        });
      } finally {
        setIsDeleteLoading(false);
      }
    }
  };

  const handleBulkDelete = () => {
    if (!canDeleteStudents) {
      toast({
        title: t("permissionDenied"),
        description: t("noPermissionToDeleteStudents"),
        variant: "destructive",
      });
      return;
    }

    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0) return;

    setBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = async () => {
    const selectedIds = getSelectedIds();
    setIsBulkDeleteLoading(true);
    try {
      await Promise.all(selectedIds.map((id) => apiDeleteStudent(id)));
      clearSelection();
      qc.invalidateQueries({ queryKey: ["students"] });
      setPage(1);
      toast({
        title: t("deleted"),
        description: `${selectedIds.length} ${t("students")} ${t("deletedSuccessfully")}`,
        variant: "success",
      });
      setBulkDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Failed to delete students:", error);
      toast({
        title: t("error"),
        description: t("failedToDeleteStudents"),
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleteLoading(false);
    }
  };

  const handleBulkChangeClass = async () => {
    if (!canEditStudents) {
      toast({
        title: t("permissionDenied"),
        description: t("noPermissionToEditStudents"),
        variant: "destructive",
      });
      return;
    }

    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0 || !bulkChangeClassId) return;

    await Promise.all(selectedIds.map((id) => apiUpdateStudent(id, { classId: bulkChangeClassId })));

    clearSelection();
    qc.invalidateQueries({ queryKey: ["students"] });
    setIsBulkChangeClassOpen(false);
    setBulkChangeClassId("");
    toast({
      title: t("updated"),
      description: `${selectedIds.length} ${t("students")} ${t("movedTo")} ${getClassName(
        bulkChangeClassId
      )}`,
      variant: "success",
    });
  };

  const handleMarkLeft = (id: string) => {
    setMarkLeftStudentId(id);
    setMarkLeftConfirmOpen(true);
  };

  const confirmMarkLeft = async () => {
    if (markLeftStudentId) {
      setIsMarkLeftLoading(true);
      try {
        await apiUpdateStudent(markLeftStudentId, {
          status: "left",
          leftDate: new Date().toISOString(),
        });
        qc.invalidateQueries({ queryKey: ["students"] });
        toast({
          title: t("updated"),
          description: t("statusUpdated"),
          variant: "success",
        });
        setMarkLeftConfirmOpen(false);
        setMarkLeftStudentId(null);
      } catch (error) {
        console.error("Failed to mark student as left:", error);
        toast({
          title: t("error"),
          description: t("failedToUpdateStudentStatus"),
          variant: "destructive",
        });
      } finally {
        setIsMarkLeftLoading(false);
      }
    }
  };

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      classId: "",
      phone: "",
      parentPhone: "",
      monthlyPayment: "",
      status: "active",
    });
    setFormErrors({});
    setEditingStudent(null);
  };

  const getClassName = (classId: string) => {
    const classData = classes.find((c) => c.id === classId);
    return classData?.name || "N/A";
  };

  const handleSearch = () => {
    // Updating searchTerm triggers the filter effect, which handles the
    // API call and page reset — no need to call loadData directly here.
    setSearchTerm(searchInput);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchTerm(""); // triggers filter effect → reload with empty search
  };

  // Students are now filtered by backend including payment status
  const paginatedStudents = students;

  const getStatusColor = (status: StudentStatus) => {
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

  if (isLoading) {
    return (

      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Filters Skeleton */}
        <div className="flex gap-4">
          <Skeleton className="h-10 w-full sm:w-64" />
          <Skeleton className="h-10 w-full sm:w-40" />
          <Skeleton className="h-10 w-full sm:w-40" />
        </div>

        {/* Table Rows Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4 border-b">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

    );
  }

  return (

    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title={t("students")} subtitle={t("manageStudents")} />

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Dialog
            open={isImportDialogOpen}
            onOpenChange={setIsImportDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Upload className="w-4 h-4 mr-2" />
                {t("importStudents")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("importStudentsFromCSV")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">
                    {t("csvFormat")} ({t("csvFormatOptions")}):
                  </p>
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    • {t("withClass")}: {t("fullName")}, {t("class")}, {t("phone")}, {t("parentPhone")},
                    {t("monthlyPayment")} ({t("optional")})
                  </p>
                  <p className="text-sm text-blue-900 dark:text-blue-100 mt-1">
                    • {t("withoutClass")}: {t("fullName")}, {t("phone")}, {t("parentPhone")}, {t("monthlyPayment")}
                    ({t("optional")})
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>{t("uploadCSVFile")}</Label>
                  <div
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {t("clickToUploadOrDragDrop")}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {t("csvFilesOnly")}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t("downloadTemplate")}
                </Button>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 py-2 border-t border-b border-slate-200 dark:border-slate-800">
                    <div className="flex-1">
                      <Label className="text-xs text-slate-600 dark:text-slate-400">
                        {t("orPasteCSVDataBelow")}
                      </Label>
                    </div>
                  </div>
                  <textarea
                    id="importData"
                    className="w-full h-40 p-3 border rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    placeholder={t("pasteYourCSVDataHere")}
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsImportDialogOpen(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={
                      isImporting ||
                      (!importData.trim() &&
                        !fileInputRef.current?.files?.length)
                    }
                  >
                    {isImporting ? t("importing") : t("importStudents")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                onClick={handleOpenDialog}
                disabled={!canCreateStudents}
                title={!canCreateStudents ? t("noPermission") : ""}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("addStudent")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingStudent ? t("editStudent") : t("addNewStudent")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("fullName")} *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => {
                        setFormData({ ...formData, fullName: e.target.value });
                        clearFieldError("fullName");
                      }}
                      className={formErrors.fullName ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {formErrors.fullName && (
                      <p className="text-xs text-red-500">{formErrors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="classId">{t("selectClass")} *</Label>
                    <Select
                      value={formData.classId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, classId: value })
                      }
                      required
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
                    <Label htmlFor="phone">{t("phone")} *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value });
                        clearFieldError("phone");
                      }}
                      placeholder="+998 XX XXX-XX-XX"
                      className={formErrors.phone ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {formErrors.phone && (
                      <p className="text-xs text-red-500">{formErrors.phone}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parentPhone">{t("parentPhone")} *</Label>
                    <Input
                      id="parentPhone"
                      type="tel"
                      value={formData.parentPhone}
                      onChange={(e) => {
                        setFormData({ ...formData, parentPhone: e.target.value });
                        clearFieldError("parentPhone");
                      }}
                      placeholder="+998 XX XXX-XX-XX"
                      className={formErrors.parentPhone ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {formErrors.parentPhone && (
                      <p className="text-xs text-red-500">{formErrors.parentPhone}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">{t("status")} *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: StudentStatus) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t("active")}</SelectItem>
                        <SelectItem value="suspended">
                          {t("suspended")}
                        </SelectItem>
                        <SelectItem value="left">{t("left")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthlyPayment">{t("monthlyPayment")} *</Label>
                    <Input
                      id="monthlyPayment"
                      type="number"
                      min="0"
                      step="500"
                      value={formData.monthlyPayment}
                      onChange={(e) =>
                        setFormData({ ...formData, monthlyPayment: e.target.value })
                      }
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    {t("cancel")}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin mr-2" />
                        {editingStudent ? t("updating") : t("creating")}
                      </>
                    ) : (
                      editingStudent ? t("update") : t("create")
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="w-full">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder={t("searchStudents")}
                    value={searchInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchInput(value);
                      // When the field is fully cleared, commit the empty search
                      // immediately (without waiting for Enter) so the list resets.
                      // The filter effect handles the API call and page reset.
                      if (value === "") {
                        setSearchTerm("");
                      }
                    }}
                    onKeyPress={handleSearchKeyPress}
                    className="pl-10 w-full"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  {t("search") || "Search"}
                </Button>
                {searchInput && (
                  <Button
                    onClick={handleClearSearch}
                    variant="outline"
                    size="sm"
                  >
                    {t("clear") || "Clear"}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("allClasses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allClasses")}</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("allStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allStatus")}</SelectItem>
                  <SelectItem value="active">{t("active")}</SelectItem>
                  <SelectItem value="suspended">{t("suspended")}</SelectItem>
                  <SelectItem value="left">{t("left")}</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterPaymentStatus}
                onValueChange={setFilterPaymentStatus}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("paymentStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allPayments")}</SelectItem>
                  <SelectItem value="paid">{t("paid")}</SelectItem>
                  <SelectItem value="partial">{t("partial")}</SelectItem>
                  <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className={`border-l-4 transition-all ${getSelectedCount() > 0
          ? "border-l-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-l-slate-300 dark:border-l-slate-600 bg-slate-50 dark:bg-slate-900/50 opacity-50"
        }`}>
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              {getSelectedCount()} {t("itemsSelected") || "items selected"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Dialog
              open={isBulkChangeClassOpen}
              onOpenChange={setIsBulkChangeClassOpen}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkChangeClassId("")}
                  disabled={getSelectedCount() === 0}
                  className="w-full sm:w-auto"
                >
                  {t("changeClass") || "Change Class"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    Change Class for Selected Students
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bulkChangeClassId">
                      {t("selectClass")} *
                    </Label>
                    <Select
                      value={bulkChangeClassId}
                      onValueChange={setBulkChangeClassId}
                      required
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
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      {getSelectedCount()} students will be moved to the
                      selected class
                    </p>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsBulkChangeClassOpen(false);
                        setBulkChangeClassId("");
                      }}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      onClick={handleBulkChangeClass}
                      disabled={!bulkChangeClassId}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {t("change") || "Change Class"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={getSelectedCount() === 0}
              className="w-full sm:w-auto"
            >
              {t("deleteSelected") || "Delete Selected"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearSelection}
              disabled={getSelectedCount() === 0}
              className="w-full sm:w-auto"
            >
              {t("cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {isListLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-4 border-b">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4">
                        <Checkbox
                          checked={
                            areAllSelected(paginatedStudents) ||
                            areSomeSelected(paginatedStudents)
                          }
                          onCheckedChange={() =>
                            toggleSelectAll(paginatedStudents)
                          }
                        />
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t("fullName")}
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t("class")}
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t("phone")}
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t("monthlyPayment")}
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t("status")}
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t("payment")}
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t("actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student) => {
                      const paymentStatus = student.payment?.status || 'unpaid';
                      const paymentStatusColor = paymentStatus === "paid"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : paymentStatus === "partial"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
                      return (
                        <tr
                          key={student.id}
                          className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 ${isSelected(student.id)
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : ""
                            }`}
                        >
                          <td className="py-3 px-4">
                            <Checkbox
                              checked={isSelected(student.id)}
                              onCheckedChange={() => toggleSelect(student.id)}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div
                              className="cursor-pointer hover:opacity-70 transition-opacity"
                              onClick={() =>
                                router.push(
                                  `/student-details?id=${student.id}&from=students`
                                )
                              }
                            >
                              <p className="font-medium text-slate-900 dark:text-slate-100 text-blue-600 dark:text-blue-400 hover:underline">
                                {toTitleCase(student.fullName)}
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {formatPhoneNumber(student.phone)}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                            {student.class?.name || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                            {formatPhoneNumber(student.phone)}
                          </td>
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                            {formatCurrency(student.monthlyPayment)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(student.status)}>
                              {t(student.status)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={paymentStatusColor}>
                              {t(paymentStatus)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  canEditStudents && handleEdit(student)
                                }
                                disabled={!canEditStudents}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {student.status === "active" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    canEditStudents && handleMarkLeft(student.id)
                                  }
                                  disabled={!canEditStudents}
                                >
                                  <UserX className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  canDeleteStudents && handleDelete(student.id)
                                }
                                disabled={!canDeleteStudents}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {paginatedStudents.map((student) => {
                  const paymentStatus = student.payment?.status || 'unpaid';
                  const paymentStatusColor = paymentStatus === "paid"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : paymentStatus === "partial"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
                  return (
                    <div
                      key={student.id}
                      className={`border rounded-lg p-4 transition-all ${isSelected(student.id)
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <Checkbox
                          checked={isSelected(student.id)}
                          onCheckedChange={() => toggleSelect(student.id)}
                          className="mt-1"
                        />
                        <div
                          className="flex-1 cursor-pointer hover:opacity-70 transition-opacity"
                          onClick={() =>
                            router.push(
                              `/student-details?id=${student.id}&from=students`
                            )
                          }
                        >
                          <p className="font-semibold text-slate-900 dark:text-slate-100 text-blue-600 dark:text-blue-400 hover:underline">
                            {toTitleCase(student.fullName)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatPhoneNumber(student.parentPhone)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600 dark:text-slate-400">{t("class")}:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {student.class?.name || "—"}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-slate-600 dark:text-slate-400 text-sm">{t("phone")}:</span>
                          <ul className="list-disc list-inside space-y-1">
                            <li className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                              {formatPhoneNumber(student.phone)}
                            </li>
                            {student.parentPhone && (
                              <li className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                                {formatPhoneNumber(student.parentPhone)}
                              </li>
                            )}
                          </ul>
                        </div>

                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600 dark:text-slate-400">{t("monthlyPayment")}:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {formatCurrency(student.monthlyPayment)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm gap-2">
                          <span className="text-slate-600 dark:text-slate-400">{t("status")}:</span>
                          <Badge className={getStatusColor(student.status)}>
                            {t(student.status)}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm gap-2">
                          <span className="text-slate-600 dark:text-slate-400">{t("payment")}:</span>
                          <Badge className={paymentStatusColor}>
                            {t(paymentStatus)}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-start">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            canEditStudents && handleEdit(student)
                          }
                          disabled={!canEditStudents}
                          className="flex-1"
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          {t("edit")}
                        </Button>
                        {student.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              canEditStudents && handleMarkLeft(student.id)
                            }
                            disabled={!canEditStudents}
                            className="flex-1"
                          >
                            <UserX className="w-4 h-4 mr-1" />
                            {t("left")}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            canDeleteStudents && handleDelete(student.id)
                          }
                          disabled={!canDeleteStudents}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {paginatedStudents.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400">
                    {t("noStudentsYet")}
                  </p>
                </div>
              )}

              {total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 px-4 py-3 border-t border-slate-200 dark:border-slate-800 gap-4">
                  <div className="flex items-center gap-4">
                    <Label className="text-sm text-slate-600 dark:text-slate-400">
                      {t("perPage") || "Per Page"}
                    </Label>
                    <Select value={limit.toString()} onValueChange={(val) => setLimit(parseInt(val))}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      {t("showing") || "Ko'rsatilyotgan"} {(page - 1) * limit + 1} – {Math.min(page * limit, total)} {t("of") || "dan"} {total}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="h-8"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1">{t("previous") || "Previous"}</span>
                    </Button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const startPage = Math.max(1, page - 2);
                        return startPage + i;
                      })
                        .filter((pageNum) => pageNum <= totalPages)
                        .map((pageNum) => (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(pageNum)}
                            className="h-8 w-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages || totalPages === 0}
                      className="h-8"
                    >
                      <span className="hidden sm:inline mr-1">{t("next") || "Next"}</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteStudentId(null);
              }}
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
                  {t("deleting") || "Deleting..."}
                </>
              ) : (
                t("delete")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmDelete")}</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600 dark:text-slate-400">
            {t("confirmDeleteMultiple")}
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              {getSelectedCount()} {t("students")} {t("willBeDeleted")}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setBulkDeleteConfirmOpen(false)}
              disabled={isBulkDeleteLoading}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={isBulkDeleteLoading}
            >
              {isBulkDeleteLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("deleting") || "Deleting..."}
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
              onClick={() => {
                setMarkLeftConfirmOpen(false);
                setMarkLeftStudentId(null);
              }}
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
                  {t("updating") || "Updating..."}
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
