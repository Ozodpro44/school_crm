
import { useEffect, useState } from "react";
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
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { formatNumberWithSpaces, removeNumberFormatting, formatPhoneNumber } from "@/lib/utils";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { createTeacher, updateTeacher, deleteTeacher, listTeachers, listClasses } from "@/lib/api";
import { searchMatchesCrossScript } from "@/lib/transliterate";

export default function TeachersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
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

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, []);

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
    const user = getCurrentUser();
    
    // If not authenticated, don't try to load data
    if (!user) {
      setTeachers([]);
      setClasses([]);
      setIsLoading(false);
      return;
    }

    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (branchId) {
        const [teacherList, classList] = await Promise.all([
          listTeachers(branchId),
          listClasses(branchId),
        ]);
        setTeachers(teacherList);
        setClasses(classList);
      }
    } catch (error) {
      console.error("Failed to load teachers:", error);
      toast({
        title: t("error"),
        description: t("failedToLoadTeachers"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canCreateTeachers = hasPermission("canCreateTeachers");
  const canEditTeachers = hasPermission("canEditTeachers");
  const canDeleteTeachers = hasPermission("canDeleteTeachers");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const hasAccess = editingTeacher ? canEditTeachers : canCreateTeachers;
    if (!hasAccess) {
      toast({
        title: t("permissionDenied"),
        description: editingTeacher ? t("permissionDeniedEdit") : t("noPermissionCreate"),
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }
    const subjectsArray = formData.subjects.split(",").map((s) => s.trim()).filter(Boolean);
    const branchId = localStorage.getItem("selectedBranchId");
    if (!branchId) {
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingTeacher) {
        await updateTeacher(editingTeacher.id, {
          fullName: formData.fullName,
          subjects: subjectsArray,
          monthlySalary: parseFloat(formData.monthlySalary),
          phone: formData.phone,
          email: formData.email,
        });
        toast({
          title: t("success"),
          description: t("teacherUpdatedSuccess"),
          variant: "success",
        });
      } else {
        await createTeacher({
          fullName: formData.fullName,
          subjects: subjectsArray,
          monthlySalary: parseFloat(formData.monthlySalary),
          phone: formData.phone,
          email: formData.email,
          password: formData.password,
          branchId: branchId,
        });
        toast({
          title: t("success"),
          description: t("teacherAddedSuccess"),
          variant: "success",
        });
      }

      resetForm();
      await loadData();
      setIsDialogOpen(false);
      } catch (error) {
      toast({
        title: t("error"),
        description: editingTeacher ? t("failedToUpdateTeacher") : t("failedToCreateTeacher"),
        variant: "destructive",
      });
      } finally {
      setIsSubmitting(false);
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

  const handleDelete = async (id: string) => {
    if (!canDeleteTeachers) {
      toast({ title: t("permissionDenied"), description: t("permissionDeniedDelete"), variant: "destructive" });
      return;
    }

    if (confirm(t("confirmDelete"))) {
      setDeletingTeacherId(id);
      setIsDeleteLoading(true);
      try {
        await deleteTeacher(id);
        await loadData();
        toast({ title: t("deleted"), description: t("teacherDeleted"), variant: "success" });
      } catch (error) {
        toast({
          title: t("error"),
          description: t("failedToDeleteTeacher"),
          variant: "destructive",
        });
      } finally {
        setIsDeleteLoading(false);
        setDeletingTeacherId(null);
      }
    }
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
        await Promise.all(selectedIds.map((id) => deleteTeacher(id)));
        clearSelection();
        await loadData();
        toast({
          title: t("deleted"),
          description: `${selectedIds.length} teachers deleted successfully`,
          variant: "success",
        });
      } catch (error) {
        toast({
          title: t("error"),
          description: t("failedToDeleteTeachers"),
          variant: "destructive",
        });
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
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t("email")} *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                    />
                  </div>

                  {!editingTeacher && (
                    <div className="space-y-2">
                      <Label htmlFor="password">{t("password")} *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required={!editingTeacher}
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Minimum 6 characters"
                      />
                      <p className="text-xs text-slate-400">
                        Teacher login will be created with this email and password.
                      </p>
                    </div>
                  )}

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
                    disabled={isSubmitting}
                  >
                    {t("cancel")}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
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
            <div className="overflow-x-auto">
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
                            disabled={!canDeleteTeachers || (isDeleteLoading && deletingTeacherId === teacher.id)}
                          >
                            {isDeleteLoading && deletingTeacherId === teacher.id ? (
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
          </CardContent>
        </Card>

      </div>

  );
}
