import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useRefetchOnFocus } from "@/hooks/use-refetch-on-focus";
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
import {
  studentsDB,
  branchesDB,
} from "@/lib/storage";
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
} from "lucide-react";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import {
   listStudents as apiListStudents,
   createStudent as apiCreateStudent,
   updateStudent as apiUpdateStudent,
   deleteStudent as apiDeleteStudent,
   listClasses as apiListClasses,
   createClass as apiCreateClass,
   listBranches as apiListBranches,
   listPayments as apiListPayments,
   getBranch,
 } from "@/lib/api";
import { Branch } from "@/types";
import type { Student as ApiStudent, Payment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { formatNumberWithSpaces, removeNumberFormatting, formatPhoneNumber } from "@/lib/utils";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { useSettings } from "@/hooks/use-settings";
import { searchMatchesCrossScript } from "@/lib/transliterate";

export default function StudentsPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
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
  const [currentPage, setCurrentPage] = useState(1);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [branchData, setBranchData] = useState<Branch | null>(null);
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
  const itemsPerPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const t = (key: string) => getTranslation(key, language);

  const loadData = async () => {
    const user = getCurrentUser();
    
    // If not authenticated, don't try to load data
    if (!user) {
      setStudents([]);
      setClasses([]);
      setPayments([]);
      setBranchData(null);
      return;
    }

    const selectedBranchId = localStorage.getItem("selectedBranchId");
    
    try {
      if (selectedBranchId) {
        const [studentsList, classList, paymentsResponse, branch] = await Promise.all([
          apiListStudents(selectedBranchId),
          apiListClasses(selectedBranchId),
          apiListPayments({ branchId: selectedBranchId }),
          getBranch(selectedBranchId),
        ]);
        const paymentsList = Array.isArray(paymentsResponse) 
          ? paymentsResponse 
          : paymentsResponse?.data || [];
        setStudents(studentsList);
        setClasses(classList);
        setPayments(paymentsList);
        setBranchData(branch);
      } else {
        setStudents([]);
        setClasses([]);
        setPayments([]);
        setBranchData(null);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: t("error"),
        description: "Failed to load students data",
        variant: "destructive",
      });
      setClasses([]);
      setPayments([]);
      setBranchData(null);
    }
  };

  useEffect(() => {
     setIsLoading(true);
     const timer = setTimeout(async () => {
       await loadData();
       setIsLoading(false);
     }, 300);
     return () => clearTimeout(timer);
   }, []);

   // Reload data when branch is switched
   useEffect(() => {
     const handleBranchChange = async () => {
       await loadData();
     };
     window.addEventListener("branchChange", handleBranchChange);
     return () => window.removeEventListener("branchChange", handleBranchChange);
   }, []);

   // Refetch data when page regains focus
   useRefetchOnFocus(loadData);

  const canCreateStudents = hasPermission("canCreateStudents");
  const canEditStudents = hasPermission("canEditStudents");
  const canDeleteStudents = hasPermission("canDeleteStudents");

  const hasCurrentMonthPayment = (studentId: string): boolean => {
    // Use branch's current financial month if available, fallback to actual current date
    const currentMonth = branchData?.currentFinancialMonth?.month?.toString().padStart(2, '0') || 
                        (new Date().getMonth() + 1).toString().padStart(2, '0');
    const currentYear = branchData?.currentFinancialMonth?.year || new Date().getFullYear();

    // Use backend payments instead of localStorage
    return payments.some(
      (payment) =>
        payment.studentId === studentId &&
        Number(payment.month) === Number(currentMonth) &&
        Number(payment.year) === currentYear
    );
  };

  const getCurrentMonthPaymentStatus = (studentId: string): string => {
     // Use branch's current financial month if available, fallback to actual current date
     const currentMonth = branchData?.currentFinancialMonth?.month?.toString().padStart(2, '0') || 
                         (new Date().getMonth() + 1).toString().padStart(2, '0');
     const currentYear = branchData?.currentFinancialMonth?.year || new Date().getFullYear();
  
     const student = students.find(s => s.id === studentId);
     if (!student) return "unpaid";
  
     // Use backend payments instead of localStorage
     const currentMonthPayments = payments.filter(
       (payment) =>
         payment.studentId === studentId &&
         Number(payment.month) === Number(currentMonth) &&
         Number(payment.year) === currentYear
     );
  
     if (currentMonthPayments.length === 0) return "unpaid";
  
     const paidTotal = currentMonthPayments.reduce((sum, p) => sum + p.amount, 0);
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

  const processCSVData = async (csvText: string) => {
    try {
      const lines = csvText.trim().split("\n");
      const branchId = localStorage.getItem("selectedBranchId");
      const branch = branchId ? branchesDB.getById(branchId) : null;
      const defaultPayment =
        branch?.monthlyPayment || settings?.monthlyPayment || 500000;

      let importedCount = 0;
      const warnings: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",").map((p) => p.trim());

        if (parts.length >= 3) {
          const [
            fullName,
            classNameOrPhone,
            phoneOrParent,
            parentPhoneOrPayment,
            monthlyPaymentStr,
          ] = parts;

          // Try to detect if second column is a class name or phone
          let className = "";
          let phone = "";
          let parentPhone = "";
          let monthlyPayment = defaultPayment;

          // Check if second column looks like a class name (contains letters)
          const isClassName = /[a-zA-Z]/i.test(classNameOrPhone);

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
                  `Row ${
                    i + 1
                  }: Could not create class "${className}" (student added without class) - ${
                    classError instanceof Error ? classError.message : "Unknown error"
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
          setCurrentPage(1);
          await loadData();
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
          description: "Failed to read file",
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
        description: "Failed to read file",
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
    setIsSubmitting(true);
    if (!canEditStudents) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to create or edit students.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const branchId = localStorage.getItem("selectedBranchId");
    const branch = branchId ? branchesDB.getById(branchId) : null;
    const monthlyPayment =
      branch?.monthlyPayment || settings?.monthlyPayment || 500000;

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
      await loadData();
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
        description: "Failed to save student",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (student: Student) => {
    if (!canEditStudents) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to edit students.",
        variant: "destructive",
      });
      return;
    }

    setEditingStudent(student);
    setFormData({
      fullName: student.fullName,
      classId: student.classId,
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
        title: "Permission Denied",
        description: "You don't have permission to delete students.",
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
        await loadData();
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
          description: "Failed to delete student",
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
        title: "Permission Denied",
        description: "You don't have permission to delete students.",
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
      await loadData();
      setCurrentPage(1);
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
        description: "Failed to delete some students",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleteLoading(false);
    }
  };

  const handleBulkChangeClass = async () => {
    if (!canEditStudents) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to edit students.",
        variant: "destructive",
      });
      return;
    }

    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0 || !bulkChangeClassId) return;

    selectedIds.forEach((id) => {
      studentsDB.update(id, { classId: bulkChangeClassId });
    });

    clearSelection();
    await loadData();
    setIsBulkChangeClassOpen(false);
    setBulkChangeClassId("");
    toast({
      title: "Updated",
      description: `${selectedIds.length} students moved to ${getClassName(
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
        await loadData();
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
          description: "Failed to update student status",
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
    setEditingStudent(null);
  };

  const getClassName = (classId: string) => {
    const classData = classes.find((c) => c.id === classId);
    return classData?.name || "N/A";
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      searchMatchesCrossScript(student.fullName, searchTerm) ||
      student.phone.includes(searchTerm) ||
      searchMatchesCrossScript(getClassName(student.classId), searchTerm);

    const matchesStatus =
      filterStatus === "all" || student.status === filterStatus;

    const matchesClass =
      filterClass === "all" || student.classId === filterClass;

    const paymentStatus = getCurrentMonthPaymentStatus(student.id);
    const matchesPaymentStatus =
      filterPaymentStatus === "all" ||
      (filterPaymentStatus === "paid" && paymentStatus === "paid") ||
      (filterPaymentStatus === "partial" && paymentStatus === "partial") ||
      (filterPaymentStatus === "unpaid" && paymentStatus === "unpaid");

    return (
      matchesSearch && matchesStatus && matchesClass && matchesPaymentStatus
    );
  });

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

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
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              {t("students")}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
              {t("manageStudents")}
            </p>
          </div>

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
                    title={!canCreateStudents ? t("noPermission") || "No permission to create students" : ""}
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
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                        required
                      />
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
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="parentPhone">{t("parentPhone")} *</Label>
                      <Input
                        id="parentPhone"
                        type="tel"
                        value={formData.parentPhone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            parentPhone: e.target.value,
                          })
                        }
                        required
                      />
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
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
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
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder={t("searchStudents")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                  />
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
                      <SelectItem value="paid">{t("paidThisMonth")}</SelectItem>
                      <SelectItem value="partial">{t("partialPayment")}</SelectItem>
                      <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
                   </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className={`border-l-4 transition-all ${
          getSelectedCount() > 0
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
                    const paymentStatus = getCurrentMonthPaymentStatus(student.id);
                    const paymentStatusColor = paymentStatus === "paid" 
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : paymentStatus === "partial"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
                    return (
                      <tr
                        key={student.id}
                        className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                          isSelected(student.id)
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
                                {student.fullName}
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {formatPhoneNumber(student.parentPhone)}
                              </p>
                            </div>
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {getClassName(student.classId)}
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
                const paymentStatus = getCurrentMonthPaymentStatus(student.id);
                const paymentStatusColor = paymentStatus === "paid" 
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : paymentStatus === "partial"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
                return (
                  <div
                    key={student.id}
                    className={`border rounded-lg p-4 transition-all ${
                      isSelected(student.id)
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
                          {student.fullName}
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
                          {getClassName(student.classId)}
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

            {filteredStudents.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  {t("noStudentsYet")}
                </p>
              </div>
            )}

            {filteredStudents.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-6 px-4 py-3 border-t border-slate-200 dark:border-slate-800 gap-4">
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-center sm:text-left">
                  Showing <span className="font-medium">{startIndex + 1}</span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(endIndex, filteredStudents.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium">{filteredStudents.length}</span>{" "}
                  students
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className="h-8"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Previous</span>
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        // Show first page, last page, current page, and pages around current
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, index, arr) => {
                        // Add ellipsis if there's a gap
                        if (
                          index > 0 &&
                          arr[index - 1] !== page - 1 &&
                          page !== arr[index - 1] + 1
                        ) {
                          return (
                            <span
                              key={`ellipsis-${page}`}
                              className="px-1 text-slate-500"
                            >
                              ...
                            </span>
                          );
                        }
                        return (
                          <Button
                            key={page}
                            variant={
                              currentPage === page ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        );
                      })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="h-8"
                  >
                    <span className="hidden sm:inline mr-1">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
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
                 {isDeleteLoading ? "Deleting..." : t("delete")}
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
                 {isBulkDeleteLoading ? "Deleting..." : t("delete")}
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
                 {isMarkLeftLoading ? "Updating..." : t("confirm")}
               </Button>
             </div>
           </DialogContent>
         </Dialog>
      </div>
    
  );
}
