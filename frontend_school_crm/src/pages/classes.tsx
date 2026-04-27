import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useRefetchOnFocus } from "@/hooks/use-refetch-on-focus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Class, Student, Teacher } from "@/types";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  BookOpen,
  Users,
  UserPlus,
  Loader2,
} from "lucide-react";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { useNotify } from "@/hooks/use-notify";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { createClass, updateClass, deleteClass, listClasses, listTeachers, listStudents, updateStudent } from "@/lib/api";
import { searchMatchesCrossScript } from "@/lib/transliterate";
import { PageHeader } from "@/components/PageHeader";

export default function ClassesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [unassignedSelection, setUnassignedSelection] = useState<string[]>([]);
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [draggedOverClass, setDraggedOverClass] = useState<string | null>(null);
  const [draggedStudentIds, setDraggedStudentIds] = useState<string[]>([]);
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
  const notify = useNotify();

  const [formData, setFormData] = useState({
    name: "",
    teacherId: "",
  });

  const t = (key: string) => getTranslation(key, language);

  const loadData = async () => {
    const user = getCurrentUser();
    
    // If not authenticated, don't try to load data
    if (!user) {
      setClasses([]);
      setTeachers([]);
      setStudents([]);
      setIsLoading(false);
      return;
    }

    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (branchId) {
        const [classList, teachersList] = await Promise.all([
          listClasses(branchId),
          listTeachers(branchId),
        ]);
        setClasses(classList);
        setTeachers(teachersList);
        loadUnassignedStudents(branchId);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error("Failed to load classes:", error);
      notify.error(t("error"), t("failedToLoadClasses"));
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnassignedStudents = async (branchId: string) => {
    try {
      const resp = await listStudents(branchId, 1, 500, { status: "active", classId: "unassigned" } as any);
      setStudents(resp.data || []);
      setStudentsLoaded(true);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, []);

  useEffect(() => {
    // Listen for branch changes
    const handleBranchChange = () => {
      loadData();
    };

    window.addEventListener("branchChange", handleBranchChange);
    return () => window.removeEventListener("branchChange", handleBranchChange);
  }, []);

  // Refetch data when page regains focus
  useRefetchOnFocus(loadData);

  const canCreateClasses = hasPermission("canCreateClasses");
  const canEditClasses = hasPermission("canEditClasses");
  const canDeleteClasses = hasPermission("canDeleteClasses");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!canEditClasses) {
      notify.error(t("permissionDenied"), t("noPermissionEditClasses"));
      setIsSubmitting(false);
      return;
    }

    const branchId = localStorage.getItem("selectedBranchId");
    if (!branchId) {
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingClass) {
        await updateClass(editingClass.id, {
          name: formData.name,
          teacherId: formData.teacherId || undefined,
        });
        notify.success(t("success"), t("classUpdatedSuccess"));
      } else {
        await createClass({
          name: formData.name,
          teacherId: formData.teacherId || undefined,
          branchId: branchId,
        });
        notify.success(t("success"), t("classAddedSuccess"));
      }

      resetForm();
      await loadData();
      setIsDialogOpen(false);
      } catch (error) {
      notify.error(t("error"), editingClass ? t("failedToUpdateClass") : t("failedToCreateClass"));
      } finally {
      setIsSubmitting(false);
      }
      };

  const handleEdit = (classData: Class) => {
    if (!canEditClasses) {
      notify.error(t("permissionDenied"), t("noPermissionEditClasses"));
      return;
    }

    setEditingClass(classData);
    setFormData({
      name: classData.name,
      teacherId: classData.teacherId || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!canDeleteClasses) {
      notify.error(t("permissionDenied"), t("noPermissionDeleteClasses"));
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: t("deleteClass"),
      message: t("confirmDeleteClass"),
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          await deleteClass(id);
          await loadData();
          notify.success(t("deleted"), t("classDeletedSuccess"));
        } catch (error) {
          notify.error(t("error"), t("failedToDeleteClass"));
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleBulkAddStudents = () => {
    if (!canEditClasses) {
      notify.error(t("permissionDenied"), t("noPermissionAssignStudents"));
      return;
    }

    if (!selectedClassId || selectedStudentIds.length === 0) return;

    const updatePromises = selectedStudentIds.map((studentId) =>
      updateStudent(studentId, { classId: selectedClassId })
    );

    Promise.all(updatePromises)
      .then(() => {
        loadData();
        setIsBulkAddOpen(false);
        setSelectedClassId("");
        setSelectedStudentIds([]);
        notify.success(t("success"), `${selectedStudentIds.length} ${t("students")} ${t("added")} ${classes.find((c) => c.id === selectedClassId)?.name}`);
      })
      .catch((error) => {
        notify.error(t("error"), error instanceof Error ? error.message : t("errorOccurred"));
      });
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleSelectAll = () => {
    const unassignedStudents = students.filter(
      (s) => !s.classId && s.status === "active"
    );
    if (selectedStudentIds.length === unassignedStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(unassignedStudents.map((s) => s.id));
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      teacherId: "",
    });
    setEditingClass(null);
  };

  const removeStudentFromClass = (studentId: string) => {
    if (!canEditClasses) {
      notify.error(t("permissionDenied"), t("noPermissionRemoveStudents"));
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: t("removeStudent"),
      message: t("confirmRemoveStudent"),
      onConfirm: async () => {
        await updateStudent(studentId, { classId: undefined });
        loadData();
        notify.success(t("updated"), t("studentRemovedFromClass"));
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
      onCancel: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
    });
  };

  const toggleUnassignedSelection = (studentId: string) => {
    setUnassignedSelection((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleSelectAllUnassigned = () => {
    if (unassignedSelection.length === unassignedStudents.length) {
      setUnassignedSelection([]);
    } else {
      setUnassignedSelection(unassignedStudents.map((s) => s.id));
    }
  };

  const openClassDetails = (classData: Class) => {
    router.push(`/class-details?id=${classData.id}`);
  };

  const handleDragStart = (student: Student) => {
    // If the student is selected, drag all selected students
    if (unassignedSelection.includes(student.id)) {
      setDraggedStudentIds(unassignedSelection);
      setDraggedStudent(student); // Show first dragged student as reference
    } else {
      // If not selected, drag only this student
      setDraggedStudentIds([student.id]);
      setDraggedStudent(student);
    }
  };

  const handleDragEnd = () => {
    setDraggedStudent(null);
    setDraggedOverClass(null);
    setDraggedStudentIds([]);
  };

  const handleDragOver = (e: React.DragEvent, classId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDraggedOverClass(classId);
  };

  const handleDragLeave = () => {
    setDraggedOverClass(null);
  };

  const handleDropOnClass = (classId: string) => {
    if (!draggedStudent || draggedStudentIds.length === 0) return;

    if (!canEditClasses) {
      notify.error(t("permissionDenied"), t("noPermissionAssignStudents"));
      setDraggedStudent(null);
      setDraggedOverClass(null);
      setDraggedStudentIds([]);
      return;
    }

    const className = classes.find((c) => c.id === classId)?.name;
    const isMultiple = draggedStudentIds.length > 1;
    const studentCount = draggedStudentIds.length;
    const studentName = draggedStudent.fullName;

    setConfirmDialog({
       isOpen: true,
       title: isMultiple ? t("moveStudents") : t("moveStudent"),
       message: isMultiple
         ? `${t("moveStudents")} ${studentCount} ${t("students")} "${className}"? ${t("moveToClass")}`
         : `${t("moveStudent")} "${studentName}" "${className}"? ${t("moveToClass")}`,
       isLoading: false,
      onConfirm: async () => {
         setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
         
         const updatePromises = draggedStudentIds.map((studentId) =>
           updateStudent(studentId, {
             classId: classId,
             classConfirmed: true,
             classSignedDate: new Date().toISOString(),
           })
         );

         Promise.all(updatePromises)
           .then(() => {
             loadData();
             setDraggedStudent(null);
             setDraggedOverClass(null);
             setDraggedStudentIds([]);
             setUnassignedSelection([]);

             notify.success(t("success"), isMultiple
                 ? `${studentCount} ${t("students")} ${t("movedAndSigned")} ${className}`
                 : `${studentName} ${t("movedAndSigned")} ${className}`);

             setConfirmDialog({ ...confirmDialog, isOpen: false, isLoading: false });
           })
           .catch((error) => {
             notify.error(t("error"), error instanceof Error ? error.message : t("errorOccurred"));
             setConfirmDialog({ ...confirmDialog, isOpen: false, isLoading: false });
           });
      },
      onCancel: () => {
        setDraggedStudent(null);
        setDraggedOverClass(null);
        setDraggedStudentIds([]);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
    });
  };

  const getTeacherName = (teacherId?: string) => {
    if (!teacherId) return t("noTeacherAssigned");
    const teacher = teachers.find((tc) => tc.id === teacherId);
    return teacher?.fullName || t("noTeacherAssigned");
  };

  const getClassStudents = (classId: string) => {
    return students.filter((s) => s.classId === classId);
  };

  const filteredClasses = classes.filter((classData) =>
    searchMatchesCrossScript(classData.name, searchTerm)
  );

  const unassignedStudents = students.filter(
    (s) => !s.classId && s.status === "active"
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Search Skeleton */}
        <Skeleton className="h-10 w-full sm:w-64" />

        {/* Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title={t("classes")} subtitle={t("manageClasses")} />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Dialog open={isBulkAddOpen} onOpenChange={setIsBulkAddOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 w-full sm:w-auto"
                disabled={unassignedStudents.length === 0}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">
                  {t("addMultipleStudentsToClass")}
                </span>
                <span className="sm:hidden">{t("addStudents")}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">
                  {t("addMultipleStudentsToClass")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="targetClass">{t("selectClass")} *</Label>
                  <Select
                    value={selectedClassId}
                    onValueChange={setSelectedClassId}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("chooseClassPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((classData) => (
                        <SelectItem key={classData.id} value={classData.id}>
                          {classData.name} ({classData.studentCount || 0} students)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50">
                    <Checkbox
                      checked={
                        selectedStudentIds.length ===
                          unassignedStudents.length &&
                        unassignedStudents.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                    <Label className="cursor-pointer font-medium">
                      {t("selectAllUnassignedStudents")} (
                      {unassignedStudents.length})
                    </Label>
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                    {unassignedStudents.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                        {t("noUnassignedStudentsFound")}
                      </div>
                    ) : (
                      unassignedStudents.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors"
                          onClick={() => toggleStudentSelection(student.id)}
                        >
                          <Checkbox
                            checked={selectedStudentIds.includes(student.id)}
                            onCheckedChange={() =>
                              toggleStudentSelection(student.id)
                            }
                          />
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {student.fullName}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {student.phone} •{" "}
                              {formatCurrency(student.monthlyPayment)}/
                              {t("month")}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {selectedStudentIds.length > 0 && selectedClassId && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                      {selectedStudentIds.length} {t("student")} selected
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      {t("willBeAddedTo") || "Will be added to:"}{" "}
                      {classes.find((c) => c.id === selectedClassId)?.name}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsBulkAddOpen(false);
                      setSelectedClassId("");
                      setSelectedStudentIds([]);
                    }}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={handleBulkAddStudents}
                    disabled={
                      !selectedClassId || selectedStudentIds.length === 0
                    }
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    {t("add")} {selectedStudentIds.length} {t("student")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog 
            open={isDialogOpen} 
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (open) {
                const branchId = localStorage.getItem("selectedBranchId");
                if (branchId) {
                  listTeachers(branchId).then(setTeachers);
                }
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="bg-brand hover:bg-brand-hover w-full sm:w-auto"
                onClick={() => resetForm()}
                disabled={!canCreateClasses}
                title={!canCreateClasses ? t("noPermission") || "No permission to create classes" : ""}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("addClass")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">
                  {editingClass ? t("editClass") : t("addNewClass")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("name")} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder={
                      t("classNamePlaceholder") || "e.g., 7A, Grade 9B"
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                   <Label htmlFor="teacherId">Class Teacher</Label>
                   <Select
                     value={formData.teacherId || "none"}
                     onValueChange={(value) =>
                       setFormData({
                         ...formData,
                         teacherId: value === "none" ? "" : value,
                       })
                     }
                   >
                     <SelectTrigger>
                       <SelectValue placeholder={t("selectTeacherOptional")} />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="none">
                         {t("noTeacherAssigned")}
                       </SelectItem>
                       {teachers.map((teacher) => (
                         <SelectItem key={teacher.id} value={teacher.id}>
                           {teacher.fullName} - {teacher.subjects.join(", ")}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
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
                        {editingClass ? t("updating") : t("creating")}
                      </>
                    ) : (
                      <>
                        {editingClass ? t("update") : t("create")} {t("class")}
                      </>
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
          <div className="flex flex-col gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t("searchClasses")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-2 text-xs sm:text-sm">
                <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">
                  {filteredClasses.length} {t("classes")}
                </span>
                <span className="sm:hidden">
                  {filteredClasses.length} {t("classes")}
                </span>
              </Badge>
              <Badge variant="outline" className="gap-2 text-xs sm:text-sm">
                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">
                  {filteredClasses.reduce((sum, c) => sum + (c.studentCount || 0), 0)}{" "}
                  {t("assignedStudents")}
                </span>
                <span className="sm:hidden">
                  {filteredClasses.reduce((sum, c) => sum + (c.studentCount || 0), 0)}
                </span>
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredClasses.map((classData) => {
              return (
                <Card
                  key={classData.id}
                  draggable={false}
                  onDragOver={(e) => handleDragOver(e, classData.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDropOnClass(classData.id)}
                  className={`hover:shadow-lg transition-all cursor-pointer ${
                    draggedOverClass === classData.id
                      ? "ring-4 ring-green-400 dark:ring-green-500 bg-green-50 dark:bg-green-900/20 shadow-2xl"
                      : ""
                  }`}
                  onClick={() => openClassDetails(classData)}
                >
                  <CardHeader className="pb-3 p-3 sm:p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base sm:text-xl truncate">
                            {classData.name}
                          </CardTitle>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
                            {getTeacherName(classData.teacherId)}
                          </p>
                        </div>
                      </div>
                      <div
                        className="flex gap-1 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(classData)}
                          disabled={!canEditClasses}
                          title={canEditClasses ? t("edit") : t("noPermission") || "No permission"}
                          className="h-8 w-8 sm:h-10 sm:w-10"
                        >
                          <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(classData.id)}
                          disabled={!canDeleteClasses}
                          title={canDeleteClasses ? t("delete") : t("noPermission") || "No permission"}
                          className="h-8 w-8 sm:h-10 sm:w-10"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                      <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t("students")}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {classData.studentCount || 0}
                      </Badge>
                    </div>
                    {draggedStudent && draggedStudentIds.length > 0 && (
                       <div className="mt-3 p-2 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded text-center">
                         <p className="text-xs font-semibold text-green-700 dark:text-green-300 line-clamp-2">
                           {draggedStudentIds.length > 1
                             ? `${t("dropHereToAddMultiple")} ${draggedStudentIds.length} ${t("students")}`
                             : `${t("dropHereToAdd")} ${draggedStudent.fullName}`}
                         </p>
                       </div>
                     )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredClasses.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">
                {t("noClassesYet")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {studentsLoaded && unassignedStudents.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg text-orange-600 dark:text-orange-400">
              {t("unassignedStudents")} ({unassignedStudents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <Checkbox
                  checked={
                    unassignedSelection.length === unassignedStudents.length &&
                    unassignedStudents.length > 0
                  }
                  onCheckedChange={toggleSelectAllUnassigned}
                  className="flex-shrink-0"
                />
                <Label className="cursor-pointer font-medium text-xs sm:text-sm">
                  {t("selectAll")} ({unassignedStudents.length})
                </Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {unassignedStudents.map((student) => (
                  <div
                    key={student.id}
                    draggable
                    onDragStart={() => handleDragStart(student)}
                    onDragEnd={handleDragEnd}
                    className={`p-3 sm:p-4 border rounded-lg cursor-grab active:cursor-grabbing transition-all ${
                      draggedStudentIds.includes(student.id)
                        ? "opacity-50 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400"
                        : "border-slate-200 dark:border-slate-800 hover:shadow-md"
                    } ${
                      unassignedSelection.includes(student.id)
                        ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 ring-2 ring-orange-300 dark:ring-orange-700"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <Checkbox
                        checked={unassignedSelection.includes(student.id)}
                        onCheckedChange={() =>
                          toggleUnassignedSelection(student.id)
                        }
                        className="mt-1 flex-shrink-0"
                      />
                      <div
                        className="flex-1 cursor-pointer min-w-0"
                        onClick={() => toggleUnassignedSelection(student.id)}
                      >
                        <p className="font-medium text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                          {student.fullName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {student.phone}
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 sm:mt-2">
                          {formatCurrency(student.monthlyPayment)}/{t("month").toLowerCase()}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 sm:mt-2">
                          📱 {t("dragToMove")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile Move Button */}
              {unassignedSelection.length > 0 && (
                <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-3">
                    {unassignedSelection.length} {t("student")} selected
                  </p>
                  <Button
                    onClick={() => {
                      setSelectedStudentIds(unassignedSelection);
                      setIsBulkAddOpen(true);
                    }}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t("moveToClass")}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                  {t("deleting") || "Deleting..."}
                </>
              ) : (
                t("confirm") || "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
