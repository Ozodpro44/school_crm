import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { useNotify } from "@/hooks/use-notify";
import { getCurrentUser } from "@/lib/auth";
import {
  listAssignments,
  createAssignment,
  deleteAssignment,
  getAssignmentSubmissions,
  updateSubmission,
  listClasses,
  AssignmentItem,
  AssignmentSubmission,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ClipboardList,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import { formatCurrency } from "@/lib/exportUtils";
import { useBranch } from "@/context/BranchContext";

export default function AssignmentsPage() {
  const language = useLanguage();
  const currentUser = getCurrentUser();
  const { currentBranch } = useBranch();

  const [isLoading, setIsLoading] = useState(true);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [classFilter, setClassFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, AssignmentSubmission[]>>({});
  const [loadingSubmissions, setLoadingSubmissions] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    classId: "",
    subject: "",
    title: "",
    description: "",
    dueDate: new Date().toISOString().slice(0, 10),
  });

  const t = (key: string) => getTranslation(key, language);
  const notify = useNotify();

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener("branchChange", handler);
    return () => window.removeEventListener("branchChange", handler);
  }, []);

  const loadData = async () => {
    const branchId = currentBranch?.id;
    if (!branchId) return;
    setIsLoading(true);
    try {
      const [assignmentsData, classesData] = await Promise.all([
        listAssignments(branchId),
        listClasses(branchId),
      ]);
      setAssignments(assignmentsData);
      setClasses(classesData);
      if (classesData.length > 0 && form.classId === "") {
        setForm((f) => ({ ...f, classId: classesData[0]!.id }));
      }
    } catch {
      notify.error(t("error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpand = async (assignmentId: string) => {
    if (expandedId === assignmentId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(assignmentId);
    if (submissions[assignmentId]) return;

    setLoadingSubmissions(assignmentId);
    try {
      const subs = await getAssignmentSubmissions(assignmentId);
      setSubmissions((prev) => ({ ...prev, [assignmentId]: subs }));
    } catch {
      notify.error(t("error"));
    } finally {
      setLoadingSubmissions(null);
    }
  };

  const handleGradeSubmission = async (
    assignmentId: string,
    subId: string,
    status: string,
    grade?: number,
    feedback?: string
  ) => {
    try {
      const updated = await updateSubmission(subId, { status, grade, feedback });
      setSubmissions((prev) => ({
        ...prev,
        [assignmentId]: (prev[assignmentId] ?? []).map((s) => (s.id === subId ? updated : s)),
      }));
    } catch {
      notify.error(t("error"));
    }
  };

  const handleCreate = async () => {
    const branchId = currentBranch?.id;
    if (!branchId || !form.classId || !form.title || !form.dueDate) return;
    setIsSaving(true);
    try {
      const a = await createAssignment({
        branchId,
        classId: form.classId,
        subject: form.subject,
        title: form.title,
        description: form.description,
        dueDate: form.dueDate,
      });
      setAssignments([a, ...assignments]);
      notify.success(t("success"));
      setDialogOpen(false);
    } catch {
      notify.error(t("error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const branchId = currentBranch?.id;
    if (!branchId) return;
    try {
      await deleteAssignment(id, branchId);
      setAssignments(assignments.filter((a) => a.id !== id));
    } catch {
      notify.error(t("error"));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{t("submitted")}</Badge>;
      case "late":
        return <Badge className="bg-orange-100 text-orange-800">{t("late")}</Badge>;
      case "missing":
        return <Badge className="bg-red-100 text-red-800">{t("missing")}</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-600">{t("pending")}</Badge>;
    }
  };

  const filteredAssignments = classFilter === "all"
    ? assignments
    : assignments.filter((a) => a.classId === classFilter);

  const className = (classId: string) =>
    classes.find((c) => c.id === classId)?.name || "—";

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-display text-slate-900 dark:text-slate-100">
            {t("assignments")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{assignments.length} total</p>
        </div>
        <div className="flex gap-3">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allClasses")}</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />{t("addAssignment")}
          </Button>
        </div>
      </div>

      {/* Assignment list */}
      {filteredAssignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>{t("noAssignments")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map((assignment) => {
            const expanded = expandedId === assignment.id;
            const subs = submissions[assignment.id] || [];
            const overdue = isOverdue(assignment.dueDate);

            return (
              <Card key={assignment.id} className={overdue && assignment.submittedCount === 0 ? "border-red-200 dark:border-red-800" : ""}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{assignment.title}</span>
                        {assignment.subject && (
                          <Badge variant="outline" className="text-xs">{assignment.subject}</Badge>
                        )}
                        {overdue && (
                          <Badge className="bg-red-100 text-red-700 text-xs">Overdue</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        <span>{className(assignment.classId)}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(assignment.dueDate).toLocaleDateString("en-GB", {
                            day: "2-digit", month: "short", year: "numeric"
                          })}
                        </span>
                        {assignment.totalStudents !== undefined && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            {assignment.submittedCount}/{assignment.totalStudents}
                          </span>
                        )}
                      </div>
                      {assignment.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{assignment.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExpand(assignment.id)}
                      >
                        {loadingSubmissions === assignment.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : expanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        <span className="ml-1 text-xs">{t("submissions")}</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-400"
                        onClick={() => handleDelete(assignment.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Submissions sub-panel */}
                  {expanded && (
                    <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                      {subs.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-2">{t("noStudentsInClass")}</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-slate-500">
                                <th className="pb-2 pr-4 font-medium">{t("fullName")}</th>
                                <th className="pb-2 pr-4 font-medium">{t("status")}</th>
                                <th className="pb-2 pr-4 font-medium">{t("grade")}</th>
                                <th className="pb-2 font-medium">{t("action")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subs.map((sub) => (
                                <tr key={sub.id} className="border-t border-slate-50 dark:border-slate-800/50">
                                  <td className="py-2 pr-4 font-medium">{toTitleCase(sub.studentName || "")}</td>
                                  <td className="py-2 pr-4">{getStatusBadge(sub.status)}</td>
                                  <td className="py-2 pr-4">
                                    {sub.grade != null ? (
                                      <span className="font-semibold">{sub.grade}/100</span>
                                    ) : "—"}
                                  </td>
                                  <td className="py-2">
                                    <div className="flex gap-1">
                                      {sub.status !== "submitted" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs"
                                          onClick={() => handleGradeSubmission(assignment.id, sub.id, "submitted")}
                                        >
                                          ✓
                                        </Button>
                                      )}
                                      {sub.status !== "missing" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs text-red-500"
                                          onClick={() => handleGradeSubmission(assignment.id, sub.id, "missing")}
                                        >
                                          ✗
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addAssignment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("class")} *</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("subject")}</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Math…" />
              </div>
              <div className="space-y-2">
                <Label>{t("dueDate")} *</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("title")} *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Homework #1…" />
            </div>
            <div className="space-y-2">
              <Label>{t("description")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-[80px]" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleCreate} disabled={isSaving || !form.classId || !form.title || !form.dueDate}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
