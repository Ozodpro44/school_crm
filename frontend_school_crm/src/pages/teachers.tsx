import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/FormDialog";
import { Field } from "@/components/Field";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Teacher } from "@/types";
import { Plus, Search, Edit2, Trash2, BookOpen, Loader2, Users } from "lucide-react";
import { hasPermission } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import {
  formatNumberWithSpaces,
  removeNumberFormatting,
  formatPhoneNumber,
  isValidUzbekPhone,
} from "@/lib/utils";
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
import { PageHeader } from "@/components/PageHeader";
import { DataTable, Column } from "@/components/DataTable";
import { InitialsAvatar } from "@/components/InitialsAvatar";

export default function TeachersPage() {
  const { currentBranch } = useBranch();
  const branchId = currentBranch?.id ?? null;

  const { data: teachers = [], isLoading } = useTeachersQuery(branchId);
  const { data: classes = [] } = useClassesQuery(branchId);

  const createMutation = useCreateTeacherMutation();
  const updateMutation = useUpdateTeacherMutation();
  const deleteMutation = useDeleteTeacherMutation();

  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null);

  const language = useLanguage();
  const { toast } = useToast();
  const t = (key: string) => getTranslation(key, language);

  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    getSelectedIds,
    areAllSelected,
    areSomeSelected,
  } = useMultiSelect<Teacher>();

  const canCreateTeachers = hasPermission("canCreateTeachers");
  const canEditTeachers = hasPermission("canEditTeachers");
  const canDeleteTeachers = hasPermission("canDeleteTeachers");

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

  const resetForm = () => {
    setFormData({ fullName: "", subjects: "", monthlySalary: "", phone: "", email: "", password: "" });
    setFormErrors({});
    setEditingTeacher(null);
  };

  const getAssignedClasses = (classIds?: string[] | null) => {
    if (!classIds || !Array.isArray(classIds)) return [];
    return classIds.map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean) as string[];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof formErrors = {};
    if (!formData.fullName.trim()) errors.fullName = t("fieldRequired") || "Required";
    if (!formData.email.trim()) errors.email = t("fieldRequired") || "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = t("invalidEmail") || "Invalid email";
    if (!formData.phone.trim()) errors.phone = t("fieldRequired") || "Required";
    else if (!isValidUzbekPhone(formData.phone))
      errors.phone = t("invalidPhone") || "Invalid phone";
    if (!editingTeacher && !formData.password)
      errors.password = t("fieldRequired") || "Required";
    else if (!editingTeacher && formData.password.length < 6)
      errors.password = t("passwordMinLength") || "Min 6 characters";

    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    if (!(editingTeacher ? canEditTeachers : canCreateTeachers)) {
      toast({ title: t("permissionDenied"), variant: "destructive" });
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
      updateMutation.mutate({ id: editingTeacher.id, data: payload }, {
        onSuccess: () => {
          toast({ title: t("success"), description: t("teacherUpdatedSuccess"), variant: "success" });
          resetForm(); setIsDialogOpen(false);
        },
        onError: () => toast({ title: t("error"), description: t("failedToUpdateTeacher"), variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ ...payload, password: formData.password, branchId }, {
        onSuccess: () => {
          toast({ title: t("success"), description: t("teacherAddedSuccess"), variant: "success" });
          resetForm(); setIsDialogOpen(false);
        },
        onError: () => toast({ title: t("error"), description: t("failedToCreateTeacher"), variant: "destructive" }),
      });
    }
  };

  const handleEdit = (teacher: Teacher) => {
    if (!canEditTeachers) { toast({ title: t("permissionDenied"), variant: "destructive" }); return; }
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
    if (!canDeleteTeachers) { toast({ title: t("permissionDenied"), variant: "destructive" }); return; }
    if (!confirm(t("confirmDelete"))) return;
    setDeletingTeacherId(id);
    deleteMutation.mutate(id, {
      onSuccess: () => { toast({ title: t("deleted"), description: t("teacherDeleted"), variant: "success" }); setDeletingTeacherId(null); },
      onError: () => { toast({ title: t("error"), description: t("failedToDeleteTeacher"), variant: "destructive" }); setDeletingTeacherId(null); },
    });
  };

  const handleBulkDelete = async () => {
    if (!canDeleteTeachers) { toast({ title: t("permissionDenied"), variant: "destructive" }); return; }
    const ids = getSelectedIds();
    if (!ids.length || !confirm(`Delete ${ids.length} teachers?`)) return;
    try {
      await Promise.all(ids.map((id) => deleteMutation.mutateAsync(id)));
      clearSelection();
      toast({ title: t("deleted"), description: `${ids.length} teachers deleted`, variant: "success" });
    } catch {
      toast({ title: t("error"), description: t("failedToDeleteTeachers"), variant: "destructive" });
    }
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      searchMatchesCrossScript(t.fullName, searchTerm) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subjects.some((s) => searchMatchesCrossScript(s, searchTerm))
  );

  // ── Column definitions ───────────────────────────────────────────────────────
  const columns: Column<Teacher>[] = [
    {
      key: "name",
      header: t("fullName"),
      render: (teacher) => (
        <div className="flex items-center gap-3">
          <InitialsAvatar name={teacher.fullName} size="md" />
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{teacher.fullName}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <BookOpen className="w-3 h-3 text-slate-400" />
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {getAssignedClasses(teacher.assignedClasses).join(", ") || t("noClassesYet")}
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: t("contact"),
      hideOnMobile: true,
      render: (teacher) => (
        <div>
          <p className="text-sm text-slate-900 dark:text-slate-100">{teacher.email}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{formatPhoneNumber(teacher.phone)}</p>
        </div>
      ),
    },
    {
      key: "subjects",
      header: t("subjects"),
      hideOnMobile: true,
      render: (teacher) => (
        <div className="flex flex-wrap gap-1">
          {teacher.subjects.slice(0, 3).map((s, i) => (
            <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
          ))}
          {teacher.subjects.length > 3 && (
            <Badge variant="secondary" className="text-xs">+{teacher.subjects.length - 3}</Badge>
          )}
        </div>
      ),
    },
    {
      key: "salary",
      header: t("salary"),
      sortable: true,
      render: (teacher) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {formatCurrency(teacher.monthlySalary)}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (teacher) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon" variant="ghost"
            onClick={(e) => { e.stopPropagation(); handleEdit(teacher); }}
            disabled={!canEditTeachers}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            size="icon" variant="ghost"
            onClick={(e) => { e.stopPropagation(); handleDelete(teacher.id); }}
            disabled={!canDeleteTeachers || (deleteMutation.isPending && deletingTeacherId === teacher.id)}
          >
            {deleteMutation.isPending && deletingTeacherId === teacher.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 text-red-500" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Add button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title={t("teachers")} subtitle={t("manageFaculty")} />

        <Button
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          disabled={!canCreateTeachers}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("addTeacher")}
        </Button>

        <FormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          title={editingTeacher ? t("editTeacher") : t("addNewTeacher")}
          onSubmit={handleSubmit}
          submitLabel={editingTeacher ? t("update") : t("create")}
          submittingLabel={editingTeacher ? t("updating") : t("creating")}
          isPending={createMutation.isPending || updateMutation.isPending}
          maxWidth="max-w-2xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field id="fullName" label={t("fullName")} required
              value={formData.fullName} error={formErrors.fullName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, fullName: e.target.value }); clearFieldError("fullName"); }}
            />
            <Field id="email" label={t("email")} type="email" required
              value={formData.email} error={formErrors.email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, email: e.target.value }); clearFieldError("email"); }}
            />
            {!editingTeacher && (
              <div>
                <Field id="password" label={t("password")} type="password" required
                  value={formData.password} error={formErrors.password}
                  autoComplete="new-password" placeholder="Minimum 6 characters"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, password: e.target.value }); clearFieldError("password"); }}
                />
                {!formErrors.password && (
                  <p className="text-xs text-slate-400 mt-1">Login will be created with this email and password.</p>
                )}
              </div>
            )}
            <Field id="phone" label={t("phone")} type="tel" required
              value={formData.phone} error={formErrors.phone}
              placeholder="+998 XX XXX-XX-XX"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, phone: e.target.value }); clearFieldError("phone"); }}
            />
            <Field id="monthlySalary" label={t("salary")} required
              value={formatNumberWithSpaces(formData.monthlySalary)} placeholder="10 000"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, monthlySalary: removeNumberFormatting(e.target.value) })}
            />
            <Field id="subjects" as="textarea"
              label={`${t("subjects")} (${t("commaSeparated") || "comma separated"}) *`}
              value={formData.subjects} placeholder={t("subjectsPlaceholder")}
              className="md:col-span-2"
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, subjects: e.target.value })}
            />
          </div>
        </FormDialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder={t("searchTeachers")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredTeachers}
            loading={isLoading}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={() => toggleSelectAll(filteredTeachers)}
            areAllSelected={areAllSelected(filteredTeachers)}
            areSomeSelected={areSomeSelected(filteredTeachers)}
            bulkActions={
              canDeleteTeachers ? (
                <>
                  <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    {t("deleteSelected") || "Delete selected"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearSelection}>{t("cancel")}</Button>
                </>
              ) : null
            }
            emptyIcon={Users}
            emptyTitle={t("noTeachersYet")}
            emptyDescription={t("addFirstTeacher") || "Add your first teacher to get started."}
            emptyAction={canCreateTeachers ? { label: t("addTeacher"), onClick: () => setIsDialogOpen(true) } : undefined}
            renderCard={(teacher, isSelected, onToggle) => (
              <div
                key={teacher.id}
                className={`border rounded-lg p-4 transition-all ${
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Checkbox checked={isSelected} onCheckedChange={onToggle} className="mt-1 flex-shrink-0" />
                    <InitialsAvatar name={teacher.fullName} size="md" className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{teacher.fullName}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{teacher.email}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{formatPhoneNumber(teacher.phone)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(teacher)} disabled={!canEditTeachers}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(teacher.id)}
                      disabled={!canDeleteTeachers || (deleteMutation.isPending && deletingTeacherId === teacher.id)}>
                      {deleteMutation.isPending && deletingTeacherId === teacher.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4 text-red-500" />}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {teacher.subjects.slice(0, 3).map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                    {teacher.subjects.length > 3 && (
                      <Badge variant="secondary" className="text-xs">+{teacher.subjects.length - 3}</Badge>
                    )}
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(teacher.monthlySalary)}</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <BookOpen className="w-3 h-3" />
                  <span>{getAssignedClasses(teacher.assignedClasses).join(", ") || t("noClassesYet")}</span>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
