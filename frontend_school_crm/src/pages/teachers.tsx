
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Teacher } from "@/types";
import { Plus, Search, Edit2, Trash2, BookOpen, Loader2 } from "lucide-react";
import { hasPermission } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { formatNumberWithSpaces, removeNumberFormatting, formatPhoneNumber, isValidUzbekPhone } from "@/lib/utils";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { useBranch } from "@/context/BranchContext";
import {
  useTeachersQuery,
  useClassesQuery,
  useCreateTeacherMutation,
  useUpdateTeacherMutation,
  useDeleteTeacherMutation,
} from "@/hooks/queries";
import { searchMatchesCrossScript } from "@/lib/transliterate";

export default function TeachersPage() {
  const { currentBranch } = useBranch();
  const branchId = currentBranch?.id ?? null;

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: teachers = [], isLoading } = useTeachersQuery(branchId);
  const { data: classes = [] } = useClassesQuery(branchId);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useCreateTeacherMutation();
  const updateMutation = useUpdateTeacherMutation();
  const deleteMutation = useDeleteTeacherMutation();

  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null);
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
  } = useMultiSelect<Teacher>();

  const [formData, setFormData] = useState({
    fullName: "",
    subjects: "",
    monthlySalary: "",
    phone: "",
    email: "",
    password: "",
  });
  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    phone?: string;
    email?: string;
    password?: string;
  }>({});

  const clearFieldError = (field: keyof typeof formErrors) => {
    if (formErrors[field]) setFormErrors((e) => ({ ...e, [field]: undefined }));
  };

  const t = (key: string) => getTranslation(key, language);

  const canCreateTeachers = hasPermission("canCreateTeachers");
  const canEditTeachers = hasPermission("canEditTeachers");
  const canDeleteTeachers = hasPermission("canDeleteTeachers");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Inline validation
    const errors: typeof formErrors = {};
    if (!formData.fullName.trim()) errors.fullName = t("fieldRequired") || "This field is required";
    if (!formData.email.trim()) {
      errors.email = t("fieldRequired") || "This field is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t("invalidEmail") || "Enter a valid email address";
    }
    if (!formData.phone.trim()) {
      errors.phone = t("fieldRequired") || "This field is required";
    } else if (!isValidUzbekPhone(formData.phone)) {
      errors.phone = t("invalidPhone") || "Enter a valid phone: +998 XX XXX-XX-XX";
    }
    if (!editingTeacher && !formData.password) {
      errors.password = t("fieldRequired") || "This field is required";
    } else if (!editingTeacher && formData.password.length < 6) {
      errors.password = t("passwordMinLength") || "Minimum 6 characters";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const hasAccess = editingTeacher ? canEditTeachers : canCreateTeachers;
    if (!hasAccess) {
      toast({
        title: t("permissionDenied"),
        description: editingTeacher ? t("permissionDeniedEdit") : t("noPermissionCreate"),
        variant: "destructive",
      });
      return;
    }
    if (!branchId) return;

    const subjectsArray = formData.subjects.split(",").map((s) => s.trim()).filter(Boolean);
    const payload = {
      fullName: formData.fullName,
      subjects: subjectsArray,
      monthlySalary: parseFloat(formData.monthlySalary),
      phone: formData.phone,
      email: formData.email,
    };

    if (editingTeacher) {
      updateMutation.mutate(
        { id: editingTeacher.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: t("success"), description: t("teacherUpdatedSuccess"), variant: "success" });
            resetForm();
            setIsDialogOpen(false);
          },
          onError: () => {
            toast({ title: t("error"), description: t("failedToUpdateTeacher"), variant: "destructive" });
          },
        }
      );
    } else {
      createMutation.mutate(
        { ...payload, password: formData.password, branchId },
        {
          onSuccess: () => {
            toast({ title: t("success"), description: t("teacherAddedSuccess"), variant: "success" });
            resetForm();
            setIsDialogOpen(false);
          },
          onError: () => {
            toast({ title: t("error"), description: t("failedToCreateTeacher"), variant: "destructive" });
          },
        }
      );
    }
  };

  const handleEdit = (teacher: Teacher) => {
    if (!canEditTeachers) {
      toast({ title: t("permissionDenied"), description: t("permissionDeniedEdit"), variant: "destructive" });
      return;
    }

    setEditingTeacher(teacher);
    setFormData({
      fullName: teacher.fullName,
      subjects: teacher.subjects.join(", "),
      monthlySalary: teacher.monthlySalary.toString(),
      phone: teacher.phone,
      email: teacher.email,
      password: "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!canDeleteTeachers) {
      toast({ title: t("permissionDenied"), description: t("permissionDeniedDelete"), variant: "destructive" });
      return;
    }
    if (!confirm(t("confirmDelete"))) return;

    setDeletingTeacherId(id);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: t("deleted"), description: t("teacherDeleted"), variant: "success" });
        setDeletingTeacherId(null);
      },
      onError: () => {
        toast({ title: t("error"), description: t("failedToDeleteTeacher"), variant: "destructive" });
        setDeletingTeacherId(null);
      },
    });
  };

  const handleBulkDelete = async () => {
    if (!canDeleteTeachers) {
      toast({ title: t("permissionDenied"), description: t("permissionDeniedDelete"), variant: "destructive" });
      return;
    }

    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0) return;

    if (confirm(`Are you sure? (${selectedIds.length} teachers)`)) {
      try {
        await Promise.all(selectedIds.map((id) => deleteMutation.mutateAsync(id)));
        clearSelection();
        toast({
          title: t("deleted"),
          description: `${selectedIds.length} teachers deleted successfully`,
          variant: "success",
        });
      } catch {
        toast({ title: t("error"), description: t("failedToDeleteTeachers"), variant: "destructive" });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      subjects: "",
      monthlySalary: "",
      phone: "",
      email: "",
      password: "",
    });
    setFormErrors({});
    setEditingTeacher(null);
  };

  const getAssignedClasses = (classIds?: string[] | null) => {
    if (!classIds || !Array.isArray(classIds)) return [];
    return classIds
      .map((id) => classes.find((c) => c.id === id)?.name)
      .filter(Boolean);
  };

  const filteredTeachers = teachers.filter((teacher) =>
    searchMatchesCrossScript(teacher.fullName, searchTerm) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.subjects.some((s) => searchMatchesCrossScript(s, searchTerm))
  );

  if (isLoading) {
    return (
      
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* Action Button Skeleton */}
          <Skeleton className="h-10 w-32" />

          {/* Search Skeleton */}
          <Skeleton className="h-10 w-full sm:w-64" />

          {/* Table Rows Skeleton */}
          <Card>
            <CardContent className="space-y-4 pt-6">
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
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {t("teachers")}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {t("manageFaculty")}
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
              <Button
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                onClick={() => resetForm()}
                disabled={!canCreateTeachers}
                title={!canCreateTeachers ? t("noPermission") || "No permission to create teachers" : ""}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("addTeacher")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTeacher ? t("editTeacher") : t("addNewTeacher")}
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
                    <Label htmlFor="email">{t("email")} *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        clearFieldError("email");
                      }}
                      className={formErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {formErrors.email && (
                      <p className="text-xs text-red-500">{formErrors.email}</p>
                    )}
                  </div>

                  {!editingTeacher && (
                    <div className="space-y-2">
                      <Label htmlFor="password">{t("password")} *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => {
                          setFormData({ ...formData, password: e.target.value });
                          clearFieldError("password");
                        }}
                        autoComplete="new-password"
                        placeholder="Minimum 6 characters"
                        className={formErrors.password ? "border-red-500 focus-visible:ring-red-500" : ""}
                      />
                      {formErrors.password ? (
                        <p className="text-xs text-red-500">{formErrors.password}</p>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Teacher login will be created with this email and password.
                        </p>
                      )}
                    </div>
                  )}

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
                    <Label htmlFor="monthlySalary">{t("salary")} *</Label>
                    <Input
                      id="monthlySalary"
                      type="text"
                      value={formatNumberWithSpaces(formData.monthlySalary)}
                      onChange={(e) =>
                        setFormData({ ...formData, monthlySalary: removeNumberFormatting(e.target.value) })
                      }
                      required
                      placeholder="10 000"
                      step="500"
                      />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="subjects">
                      {t("subjects")} ({t("commaSeparated") || "comma separated"}) *
                    </Label>
                    <Textarea
                      id="subjects"
                      value={formData.subjects}
                      onChange={(e) =>
                        setFormData({ ...formData, subjects: e.target.value })
                      }
                      placeholder={t("subjectsPlaceholder")}
                      required
                    />
                  </div>
                </div>

                  <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {t("cancel")}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin mr-2" />
                        {editingTeacher ? t("updating") : t("creating")}
                      </>
                    ) : (
                      editingTeacher ? t("update") : t("create")
                    )}
                  </Button>
                  </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t("searchTeachers")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            </CardHeader>
            </Card>

            <Card className={`border-l-4 transition-all ${
              getSelectedCount() > 0
                ? "border-l-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-l-slate-300 dark:border-l-slate-600 bg-slate-50 dark:bg-slate-900/50 opacity-50"
            }`}>
            <CardContent className="py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {getSelectedCount()} {t("itemsSelected") || "items selected"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={getSelectedCount() === 0}
                >
                  {t("deleteSelected") || "Delete Selected"}
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
            </CardContent>
            </Card>

            <Card>
            <CardContent>
            {/* Desktop table */}
            <div className="hidden md:overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left py-3 px-4">
                      <Checkbox
                        checked={areAllSelected(filteredTeachers) || areSomeSelected(filteredTeachers)}
                        onCheckedChange={() => toggleSelectAll(filteredTeachers)}
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("fullName")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("contact")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("subjects")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("salary")}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((teacher) => (
                    <tr
                      key={teacher.id}
                      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                        isSelected(teacher.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <Checkbox
                          checked={isSelected(teacher.id)}
                          onCheckedChange={() => toggleSelect(teacher.id)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {teacher.fullName}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <BookOpen className="w-3 h-3 text-slate-400" />
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {getAssignedClasses(teacher.assignedClasses).join(", ") || t("noClassesYet")}
                                  </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm text-slate-900 dark:text-slate-100">
                            {teacher.email}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {formatPhoneNumber(teacher.phone)}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {teacher.subjects.slice(0, 3).map((subject, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {subject}
                            </Badge>
                          ))}
                          {teacher.subjects.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{teacher.subjects.length - 3}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                        {formatCurrency(teacher.monthlySalary)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => canEditTeachers && handleEdit(teacher)}
                            disabled={!canEditTeachers}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => canDeleteTeachers && handleDelete(teacher.id)}
                            disabled={!canDeleteTeachers || (deleteMutation.isPending && deletingTeacherId === teacher.id)}
                          >
                            {deleteMutation.isPending && deletingTeacherId === teacher.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-500" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredTeachers.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400">
                    {t("noTeachersYet")}
                  </p>
                </div>
              )}
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {filteredTeachers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400">{t("noTeachersYet")}</p>
                </div>
              ) : (
                filteredTeachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className={`border rounded-lg p-4 transition-all ${
                      isSelected(teacher.id)
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Checkbox
                          checked={isSelected(teacher.id)}
                          onCheckedChange={() => toggleSelect(teacher.id)}
                          className="mt-1 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {teacher.fullName}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                            {teacher.email}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {formatPhoneNumber(teacher.phone)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => canEditTeachers && handleEdit(teacher)}
                          disabled={!canEditTeachers}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => canDeleteTeachers && handleDelete(teacher.id)}
                          disabled={!canDeleteTeachers || (deleteMutation.isPending && deletingTeacherId === teacher.id)}
                        >
                          {deleteMutation.isPending && deletingTeacherId === teacher.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-500" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {teacher.subjects.slice(0, 3).map((subject, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {subject}
                          </Badge>
                        ))}
                        {teacher.subjects.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{teacher.subjects.length - 3}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(teacher.monthlySalary)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <BookOpen className="w-3 h-3" />
                      <span>{getAssignedClasses(teacher.assignedClasses).join(", ") || t("noClassesYet")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

      </div>

  );
}
