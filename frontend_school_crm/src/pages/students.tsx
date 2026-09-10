import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormDialog } from "@/components/FormDialog";
import { Field } from "@/components/Field";
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
  Loader2,
  Users,
} from "lucide-react";
import { hasPermission } from "@/lib/auth";
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
import { useNotify } from "@/hooks/use-notify";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { formatPhoneNumber, isValidUzbekPhone, toTitleCase } from "@/lib/utils";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { useSettings } from "@/hooks/use-settings";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, Column } from "@/components/DataTable";
import { FilterBar, FilterSearch, FilterReset, filterSelectClass } from "@/components/FilterBar";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";

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
  const [bulkChangeClassSearch, setBulkChangeClassSearch] = useState<string>("");
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
  } = useStudentsConsolidatedQuery(branchId, page, limit, queryFilters, {
    refetchOnWindowFocus: true,
  });

  const { data: classesData, refetch: refetchClasses } = useClassesQuery(branchId, {
    refetchOnMount: "always",
  });

  const students = (studentsData?.items ?? []) as unknown as Student[];
  const total: number = studentsData?.total ?? 0;
  const classes = (classesData ?? studentsData?.classes ?? []) as Array<{ id: string; name: string }>;
  const language = useLanguage();
  const notify = useNotify();
  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
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
    classId?: string;
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

  const processCSVData = async (csvText: string) => {
    try {
      const lines = csvText.trim().split("\n");
      const defaultPayment = settings?.monthlyPayment || 500000;
      const knownClasses = [...classes];

      let importedCount = 0;
      let createdClassCount = 0;
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
            const classObj = knownClasses.find(
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
                knownClasses.push(newClass);
                createdClassCount++;
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
        notify.success(t("importComplete"), `${t("successfullyImported")} ${importedCount} ${t("students")}`);
      }

      if (warnings.length > 0) {
        notify.warning(t("importCompletedWithWarnings"), warnings.slice(0, 3).join("\n") + (warnings.length > 3 ? `\n... and ${warnings.length - 3} more` : ""));
      }

      setImportData("");
      setIsImportDialogOpen(false);
      setPage(1);
      void qc.invalidateQueries({ queryKey: ["students"] });
      if (createdClassCount > 0) {
        void qc.invalidateQueries({ queryKey: ["classes", branchId] });
      }
    } catch (error) {
      notify.error(t("importError"), t("errorCheckFormat"));
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
        notify.error(t("importError"), t("failedToReadFile"));
        console.error(error);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };

    reader.onerror = () => {
      notify.error(t("importError"), t("failedToReadFile"));
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
    if (!formData.fullName.trim()) errors.fullName = t("fieldRequired");
    if (!formData.phone.trim()) {
      errors.phone = t("fieldRequired");
    } else if (!isValidUzbekPhone(formData.phone)) {
      errors.phone = t("invalidPhone");
    }
    if (!formData.parentPhone.trim()) {
      errors.parentPhone = t("fieldRequired");
    } else if (!isValidUzbekPhone(formData.parentPhone)) {
      errors.parentPhone = t("invalidPhone");
    }
    // classId is marked required (*) in the form below but was never
    // actually checked here — a student could be created/edited with no
    // class at all. monthlyPayment left blank still auto-fills from the
    // branch default further down (that convenience is intentional and
    // preserved), but an explicitly-entered value must be positive — a
    // negative one (e.g. "-5000") previously passed straight through:
    // parseInt("-5000") is truthy, so the `|| defaultMonthlyPayment`
    // fallback never caught it.
    if (!formData.classId) errors.classId = t("fieldRequired");
    if (formData.monthlyPayment.trim() && !(parseInt(formData.monthlyPayment) > 0)) {
      errors.monthlyPayment = t("mustBePositive");
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    if (!canEditStudents) {
      notify.error(t("permissionDenied"), t("noPermissionToCreateOrEditStudents"));
      setIsSubmitting(false);
      return;
    }

    const defaultMonthlyPayment = settings?.monthlyPayment || 500000;
    const monthlyPayment = formData.monthlyPayment.trim()
      ? parseInt(formData.monthlyPayment)
      : defaultMonthlyPayment;

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
      notify.success(editingStudent ? t("updated") : t("created"), editingStudent ? t("studentUpdatedSuccessfully") : t("studentCreatedSuccessfully"));
    } catch (error) {
      console.error("Failed to save student:", error);
      notify.error(t("error"), t("failedToSaveStudent"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (student: Student) => {
    if (!canEditStudents) {
      notify.error(t("permissionDenied"), t("noPermissionToEditStudents"));
      return;
    }

    setEditingStudent(student);
    void refetchClasses();
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
      notify.error(t("permissionDenied"), t("noPermissionToDeleteStudents"));
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
        notify.success(t("deleted"), t("successfullyDeleted"));
        setDeleteConfirmOpen(false);
        setDeleteStudentId(null);
      } catch (error) {
        console.error("Failed to delete student:", error);
        notify.error(t("error"), t("failedToDeleteStudent"));
      } finally {
        setIsDeleteLoading(false);
      }
    }
  };

  const handleBulkDelete = () => {
    if (!canDeleteStudents) {
      notify.error(t("permissionDenied"), t("noPermissionToDeleteStudents"));
      return;
    }

    const ids = getSelectedIds();
    if (ids.length === 0) return;

    setBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = async () => {
    const ids = getSelectedIds();
    setIsBulkDeleteLoading(true);
    try {
      // allSettled, not all: a single rejection in Promise.all jumps straight
      // to catch without invalidating the query cache, so students that DID
      // delete successfully (their requests already resolved independently)
      // kept showing in the table until an unrelated refetch happened.
      const results = await Promise.allSettled(ids.map((id) => apiDeleteStudent(id)));
      const failedCount = results.filter((r) => r.status === "rejected").length;
      const succeededCount = ids.length - failedCount;

      clearSelection();
      if (succeededCount > 0) {
        qc.invalidateQueries({ queryKey: ["students"] });
        setPage(1);
      }

      if (failedCount === 0) {
        notify.success(t("deleted"), `${ids.length} ${t("students")} ${t("deletedSuccessfully")}`);
        setBulkDeleteConfirmOpen(false);
      } else if (succeededCount === 0) {
        notify.error(t("error"), t("failedToDeleteStudents"));
      } else {
        notify.error(
          t("error"),
          `${succeededCount}/${ids.length} ${t("deletedSuccessfully")} — ${failedCount} ${t("failedToDeleteStudents")}`
        );
        setBulkDeleteConfirmOpen(false);
      }
    } finally {
      setIsBulkDeleteLoading(false);
    }
  };

  const handleBulkChangeClass = async () => {
    if (!canEditStudents) {
      notify.error(t("permissionDenied"), t("noPermissionToEditStudents"));
      return;
    }

    const ids = getSelectedIds();
    if (ids.length === 0 || !bulkChangeClassId) return;

    try {
      const results = await Promise.allSettled(
        ids.map((id) => apiUpdateStudent(id, { classId: bulkChangeClassId }))
      );
      const failedCount = results.filter((r) => r.status === "rejected").length;
      const succeededCount = ids.length - failedCount;

      clearSelection();
      if (succeededCount > 0) {
        qc.invalidateQueries({ queryKey: ["students"] });
      }
      setIsBulkChangeClassOpen(false);
      setBulkChangeClassId("");

      if (failedCount === 0) {
        notify.success(t("updated"), `${ids.length} ${t("students")} ${t("movedTo")} ${getClassName(
            bulkChangeClassId
          )}`);
      } else {
        notify.error(
          t("error"),
          `${succeededCount}/${ids.length} ${t("movedTo")} ${getClassName(bulkChangeClassId)}`
        );
      }
    } catch (error) {
      // Promise.allSettled never rejects — this only catches a bug elsewhere
      // in this function, but previously there was no handler at all, so a
      // rejection here surfaced as an unhandled promise rejection with the
      // dialog stuck open and no feedback to the user.
      console.error("Failed to change class for students:", error);
      notify.error(t("error"), t("failedToUpdateStudentStatus"));
    }
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
        notify.success(t("updated"), t("statusUpdated"));
        setMarkLeftConfirmOpen(false);
        setMarkLeftStudentId(null);
      } catch (error) {
        console.error("Failed to mark student as left:", error);
        notify.error(t("error"), t("failedToUpdateStudentStatus"));
      } finally {
        setIsMarkLeftLoading(false);
      }
    }
  };

  const handleOpenDialog = () => {
    resetForm();
    void refetchClasses();
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
    setSearchTerm(searchInput);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchTerm("");
  };

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

  // ── Column definitions ──────────────────────────────────────────────────────
  const columns: Column<Student>[] = [
    {
      key: "name",
      header: t("fullName"),
      render: (student) => (
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => router.push(`/student-details?id=${student.id}&from=students`)}
        >
          <InitialsAvatar name={student.fullName} size="md" />
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:underline truncate">
              {toTitleCase(student.fullName)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatPhoneNumber(student.phone)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "class",
      header: t("class"),
      hideOnMobile: true,
      render: (student) => (
        <span className="text-slate-900 dark:text-slate-100">
          {student.class?.name || "—"}
        </span>
      ),
    },
    {
      key: "phone",
      header: t("phone"),
      hideOnMobile: true,
      render: (student) => (
        <span className="text-slate-900 dark:text-slate-100">
          {formatPhoneNumber(student.phone)}
        </span>
      ),
    },
    {
      key: "monthlyPayment",
      header: t("monthlyPayment"),
      hideOnMobile: true,
      render: (student) => (
        <span className="text-slate-900 dark:text-slate-100">
          {formatCurrency(student.monthlyPayment)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("status"),
      render: (student) => (
        <Badge className={getStatusColor(student.status)}>
          {t(student.status)}
        </Badge>
      ),
    },
    {
      key: "payment",
      header: t("payment"),
      render: (student) => {
        const paymentStatus = student.payment?.status || "unpaid";
        return <PaymentStatusBadge status={paymentStatus} label={t(paymentStatus)} />;
      },
    },
    {
      key: "actions",
      header: t("actions"),
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (student) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("edit")}
            onClick={(e) => { e.stopPropagation(); handleEdit(student); }}
            disabled={!canEditStudents}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          {student.status === "active" && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("markAsLeft")}
              onClick={(e) => { e.stopPropagation(); canEditStudents && handleMarkLeft(student.id); }}
              disabled={!canEditStudents}
            >
              <UserX className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("delete")}
            onClick={(e) => { e.stopPropagation(); canDeleteStudents && handleDelete(student.id); }}
            disabled={!canDeleteStudents}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  const bulkActions = (
    <>
      <Dialog open={isBulkChangeClassOpen} onOpenChange={setIsBulkChangeClassOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setBulkChangeClassId("");
              void refetchClasses();
            }}
          >
            {t("changeClass")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-base">{t("changeClass")}</DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t("searchClasses")}
                value={bulkChangeClassSearch}
                onChange={(e) => setBulkChangeClassSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 -mr-2 pr-2">
              {(() => {
                const term = bulkChangeClassSearch.toLowerCase();
                const filtered = classes.filter((c: any) =>
                  c.name.toLowerCase().includes(term)
                );
                if (filtered.length === 0) {
                  return (
                    <p className="text-sm text-slate-400 text-center py-6">
                      {t("noClassesFound")}
                    </p>
                  );
                }
                return filtered.map((cls: any) => {
                  const selected = bulkChangeClassId === cls.id;
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setBulkChangeClassId(cls.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm text-left transition-colors ${
                        selected
                          ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span>{cls.name}</span>
                      {selected && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400">✓</span>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-y border-blue-100 dark:border-blue-900/50">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-semibold">{selectedIds.size}</span>{" "}
              {t("studentsWillBeMoved")}
            </p>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsBulkChangeClassOpen(false);
                setBulkChangeClassId("");
                setBulkChangeClassSearch("");
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleBulkChangeClass}
              disabled={!bulkChangeClassId}
            >
              {t("change")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Button
        size="sm"
        variant="destructive"
        onClick={handleBulkDelete}
      >
        {t("deleteSelected")}
      </Button>
      <Button size="sm" variant="outline" onClick={clearSelection}>
        {t("cancel")}
      </Button>
    </>
  );

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

          <Button
            className="w-full sm:w-auto bg-brand hover:bg-brand-hover"
            onClick={handleOpenDialog}
            disabled={!canCreateStudents}
            title={!canCreateStudents ? t("noPermission") : ""}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("addStudent")}
          </Button>

          <FormDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            title={editingStudent ? t("editStudent") : t("addNewStudent")}
            onSubmit={handleSubmit}
            submitLabel={editingStudent ? t("update") : t("create")}
            submittingLabel={editingStudent ? t("updating") : t("creating")}
            isPending={isSubmitting}
            maxWidth="max-w-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                id="fullName"
                label={`${t("fullName")} *`}
                value={formData.fullName}
                error={formErrors.fullName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFormData({ ...formData, fullName: e.target.value });
                  clearFieldError("fullName");
                }}
              />

              <div className="space-y-2">
                <Label htmlFor="classId">{t("selectClass")} *</Label>
                <Select
                  value={formData.classId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, classId: value });
                    clearFieldError("classId");
                  }}
                  required
                >
                  <SelectTrigger className={formErrors.classId ? "border-red-500 focus:ring-red-500" : ""}>
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
                {formErrors.classId && (
                  <p className="text-xs text-red-500">{formErrors.classId}</p>
                )}
              </div>

              <Field
                id="phone"
                label={`${t("phone")} *`}
                type="tel"
                value={formData.phone}
                error={formErrors.phone}
                placeholder="+998 XX XXX-XX-XX"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFormData({ ...formData, phone: e.target.value });
                  clearFieldError("phone");
                }}
              />

              <Field
                id="parentPhone"
                label={`${t("parentPhone")} *`}
                type="tel"
                value={formData.parentPhone}
                error={formErrors.parentPhone}
                placeholder="+998 XX XXX-XX-XX"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFormData({ ...formData, parentPhone: e.target.value });
                  clearFieldError("parentPhone");
                }}
              />

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

              <Field
                id="monthlyPayment"
                label={`${t("monthlyPayment")} *`}
                type="number"
                min="0"
                step="500"
                value={formData.monthlyPayment}
                error={formErrors.monthlyPayment}
                placeholder="0"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFormData({ ...formData, monthlyPayment: e.target.value });
                  clearFieldError("monthlyPayment");
                }}
              />
            </div>
          </FormDialog>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar>
        <FilterSearch
          value={searchInput}
          onChange={(v) => { setSearchInput(v); if (v === "") setSearchTerm(""); }}
          onSearch={handleSearch}
          placeholder={t("searchStudents")}
        />
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className={filterSelectClass("w-40")}>
            <SelectValue placeholder={t("allClasses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allClasses")}</SelectItem>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className={filterSelectClass("w-36")}>
            <SelectValue placeholder={t("allStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatus")}</SelectItem>
            <SelectItem value="active">{t("active")}</SelectItem>
            <SelectItem value="suspended">{t("suspended")}</SelectItem>
            <SelectItem value="left">{t("left")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
          <SelectTrigger className={filterSelectClass("w-40")}>
            <SelectValue placeholder={t("paymentStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allPayments")}</SelectItem>
            <SelectItem value="paid">{t("paid")}</SelectItem>
            <SelectItem value="partial">{t("partial")}</SelectItem>
            <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
          </SelectContent>
        </Select>
        <FilterReset
          onClick={handleClearSearch}
          show={searchInput !== "" || filterClass !== "all" || filterStatus !== "all" || filterPaymentStatus !== "all"}
          label={t("reset")}
        />
      </FilterBar>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={students}
            loading={isLoading}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={() => toggleSelectAll(students)}
            areAllSelected={areAllSelected(students)}
            areSomeSelected={areSomeSelected(students)}
            bulkActions={bulkActions}
            pagination={{ page, limit, total }}
            onPageChange={setPage}
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
            limitOptions={[5, 10, 20, 50, 100]}
            emptyIcon={Users}
            emptyTitle={t("noStudentsYet")}
            emptyDescription={t("addFirstStudent")}
            emptyAction={canCreateStudents ? { label: t("addStudent"), onClick: handleOpenDialog } : undefined}
            renderCard={(student, isSelected, onToggle) => {
              const paymentStatus = student.payment?.status || "unpaid";
              return (
                <div
                  key={student.id}
                  className={`border rounded-lg p-4 transition-all ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={onToggle}
                      className="mt-1"
                    />
                    <div
                      className="flex-1 cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() =>
                        router.push(`/student-details?id=${student.id}&from=students`)
                      }
                    >
                      <p className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
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
                      <PaymentStatusBadge status={paymentStatus} label={t(paymentStatus)} />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-start">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => canEditStudents && handleEdit(student)}
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
                        onClick={() => canEditStudents && handleMarkLeft(student.id)}
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
                      aria-label={t("delete")}
                      onClick={() => canDeleteStudents && handleDelete(student.id)}
                      disabled={!canDeleteStudents}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            }}
          />
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
                  {t("deleting")}
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
              {selectedIds.size} {t("students")} {t("willBeDeleted")}
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
