import { useState, useEffect } from "react";
import { useRouter } from "next/router";
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
import { useNotify } from "@/hooks/use-notify";
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
import { FilterBar, FilterSearch } from "@/components/FilterBar";

export default function TeachersPage() {
  const router = useRouter();
  const { currentBranch } = useBranch();
  const branchId = currentBranch?.id ?? null;

  // The sidebar already hides this link for anyone lacking canViewTeachers
  // (see Layout.tsx), but that alone doesn't stop someone from typing the
  // URL directly — mirrors the same page-level guard settings.tsx uses for
  // canViewSettings.
  useEffect(() => {
    if (!hasPermission("canViewTeachers")) {
      router.push("/");
    }
  }, [router]);

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
  const notify = useNotify();
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
    monthlySalary?: string;
  }>({});

  const clearFieldError = (field: keyof typeof formErrors) => {
    if (formErrors[field]) setFormErrors((e) => ({ ...e, [field]: undefined }));
  };

  const resetForm = () => {
    setFormData({ fullName: "", subjects: "", monthlySalary: "", phone: "", email: "", password: "" });
    setFormErrors({});
    setEditingTeacher(null);
  };

  // teacher_service's Teacher struct has no assignedClasses field — the
  // link only exists the other way, as Class.teacherId — so this is
  // computed from the already-fetched classes list instead of read off
  // the teacher record (which was always undefined, showing "No classes
  // yet" for every teacher regardless of actual assignments).
  const getAssignedClasses = (teacherId: string) => {
    return classes.filter((c) => c.teacherId === teacherId).map((c) => c.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof formErrors = {};
    if (!formData.fullName.trim()) errors.fullName = t("fieldRequired");
    if (!formData.email.trim()) errors.email = t("fieldRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = t("invalidEmail");
    if (!formData.phone.trim()) errors.phone = t("fieldRequired");
    else if (!isValidUzbekPhone(formData.phone))
      errors.phone = t("invalidPhone");
    if (!editingTeacher && !formData.password)
      errors.password = t("fieldRequired");
    else if (!editingTeacher && formData.password.length < 6)
      errors.password = t("passwordMinLength");
    // Previously unvalidated: parseFloat of a blank/negative monthlySalary
    // (e.g. "" or "-1000") is NaN or negative, sent straight to the API.
    if (!formData.monthlySalary.trim() || !(parseFloat(formData.monthlySalary) > 0)) {
      errors.monthlySalary = formData.monthlySalary.trim() ? t("mustBePositive") : t("fieldRequired");
    }

    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    if (!(editingTeacher ? canEditTeachers : canCreateTeachers)) {
      notify.error(t("permissionDenied"));
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
          notify.success(t("success"), t("teacherUpdatedSuccess"));
          resetForm(); setIsDialogOpen(false);
        },
        onError: () => notify.error(t("error"), t("failedToUpdateTeacher")),
      });
    } else {
      createMutation.mutate({ ...payload, password: formData.password, branchId }, {
        onSuccess: () => {
          notify.success(t("success"), t("teacherAddedSuccess"));
          resetForm(); setIsDialogOpen(false);
        },
        onError: () => notify.error(t("error"), t("failedToCreateTeacher")),
      });
    }
  };

  const handleEdit = (teacher: Teacher) => {
    if (!canEditTeachers) { notify.error(t("permissionDenied")); return; }
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
    if (!canDeleteTeachers) { notify.error(t("permissionDenied")); return; }
    if (!confirm(t("confirmDelete"))) return;
    setDeletingTeacherId(id);
    deleteMutation.mutate(id, {
      onSuccess: () => { notify.success(t("deleted"), t("teacherDeleted")); setDeletingTeacherId(null); },
      onError: () => { notify.error(t("error"), t("failedToDeleteTeacher")); setDeletingTeacherId(null); },
    });
  };

  const handleBulkDelete = async () => {
    if (!canDeleteTeachers) { notify.error(t("permissionDenied")); return; }
    const ids = getSelectedIds();
    if (!ids.length || !confirm(`Delete ${ids.length} teachers?`)) return;
    // allSettled, not all: a single rejection in Promise.all jumped straight
    // to catch with one generic toast and skipped clearSelection() — rows
    // that HAD deleted successfully stayed marked "selected" in the UI.
    const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync(id)));
    const failedCount = results.filter((r) => r.status === "rejected").length;
    const succeededCount = ids.length - failedCount;
    clearSelection();
    if (failedCount === 0) {
      notify.success(t("deleted"), `${ids.length} teachers deleted`);
    } else if (succeededCount === 0) {
      notify.error(t("error"), t("failedToDeleteTeachers"));
    } else {
      notify.error(t("error"), `${succeededCount}/${ids.length} deleted — ${failedCount} failed`);
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
                {getAssignedClasses(teacher.id).join(", ") || t("noClassesYet")}
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
        <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">
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
          className="bg-brand hover:bg-brand-hover"
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
              value={formatNumberWithSpaces(formData.monthlySalary)} error={formErrors.monthlySalary} placeholder="10 000"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, monthlySalary: removeNumberFormatting(e.target.value) }); clearFieldError("monthlySalary"); }}
            />
            <Field id="subjects" as="textarea"
              label={`${t("subjects")} (${t("commaSeparated")}) *`}
              value={formData.subjects} placeholder={t("subjectsPlaceholder")}
              className="md:col-span-2"
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, subjects: e.target.value })}
            />
          </div>
        </FormDialog>
      </div>

      {/* Search */}
      <FilterBar>
        <FilterSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={t("searchTeachers")}
        />
      </FilterBar>

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
                    {t("deleteSelected")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearSelection}>{t("cancel")}</Button>
                </>
              ) : null
            }
            emptyIcon={Users}
            emptyTitle={t("noTeachersYet")}
            emptyDescription={t("addFirstTeacher")}
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
                  <span>{getAssignedClasses(teacher.id).join(", ") || t("noClassesYet")}</span>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
