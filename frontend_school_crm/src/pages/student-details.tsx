import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Student, Payment, Branch, Class } from "@/types";
import {
  ArrowLeft,
  Phone,
  Users,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  UserX,
  Loader2,
  MessageSquare,
  PhoneCall,
  ClipboardList,
  Plus,
  X,
} from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { useNotify } from "@/hooks/use-notify";
import { hasPermission, getCurrentUser } from "@/lib/auth";
import { formatPhoneNumber, toTitleCase, formatDate } from "@/lib/utils";
import { useBranch } from "@/context/BranchContext";
import {
  getStudent,
  listClasses,
  getStudentPaymentHistory,
  getBranch,
  updateStudent,
  deleteStudent,
  getStudentAttendanceRecords,
  listStudentNotes,
  addStudentNote,
  deleteStudentNote,
  listContactLog,
  addContactLog,
  deleteContactLog,
  AttendanceRecord,
  StudentNote,
  ContactLogEntry,
} from "@/lib/api";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { PaymentTrendChart } from "@/components/PaymentTrendChart";
import { AttendanceDonut } from "@/components/AttendanceDonut";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";

type Tab = "overview" | "payments" | "attendance" | "notes" | "contact";

// Short 3-letter month labels pulled from translations, or numeric fallbacks.
const MONTH_LABELS_SHORT = (t: (k: string) => string): Record<number, string> => {
  const keys = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  const out: Record<number, string> = {};
  keys.forEach((k, i) => {
    const translated = t(k);
    out[i + 1] = translated && translated !== k ? translated : String(i + 1);
  });
  return out;
};

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-2.5 h-2.5 rounded-full inline-block"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </span>
  );
}

export default function StudentDetailsPage() {
  const router = useRouter();
  const { id, from } = router.query;
  const { currentBranch, isLoading: branchLoading } = useBranch();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [contactLogEntries, setContactLogEntries] = useState<ContactLogEntry[]>([]);
  const [className, setClassName] = useState("");
  const [backRoute, setBackRoute] = useState<string>("/students");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [markLeftConfirmOpen, setMarkLeftConfirmOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isMarkLeftLoading, setIsMarkLeftLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    classId: "",
    phone: "",
    parentPhone: "",
    status: "active" as Student["status"],
    monthlyPayment: "",
  });

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Contact log state
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    contactType: "call",
    outcome: "no_answer",
    note: "",
    contactedAt: new Date().toISOString().slice(0, 16),
  });
  const [isAddingContact, setIsAddingContact] = useState(false);

  const language = useLanguage();
  const canEditStudents = hasPermission("canEditStudents");
  const canDeleteStudents = hasPermission("canDeleteStudents");
  const currentUser = getCurrentUser();

  const t = (key: string) => getTranslation(key, language);
  const notify = useNotify();

  // Guards a rapid id/branch change: without this, an older still-in-flight
  // loadData() call could resolve after a newer one and overwrite the
  // screen with the previous student's data.
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    if (!id) return;
    // See the equivalent guard in assignments.tsx: without the branchLoading
    // check, a branch that never resolves left isLoading stuck forever.
    if (branchLoading) return;
    if (!currentBranch?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const myId = ++loadRequestIdRef.current;
    loadData(myId).finally(() => {
      if (myId === loadRequestIdRef.current) setIsLoading(false);
    });
  }, [id, currentBranch?.id, branchLoading]);

  useEffect(() => {
    if (from === "class") {
      const classId = router.query.classId;
      if (classId) setBackRoute(`/class-details?id=${classId}`);
    } else {
      setBackRoute("/students");
    }
  }, [from, router.query.classId]);

  const loadData = async (myId: number) => {
    if (!id) return;
    const branchId = currentBranch?.id;

    try {
      const studentData = await getStudent(id as string);
      if (!studentData) return;
      if (myId !== loadRequestIdRef.current) return;
      setStudent(studentData);

      // All remaining calls are independent — run in parallel. Every one
      // has its own .catch(): listClasses/getBranch previously didn't, so a
      // failure in either of these secondary/context fetches rejected the
      // whole Promise.all and fell into the outer catch below, which called
      // setStudent(null) — wiping out the student profile that had already
      // loaded successfully just above.
      const [classesData, branch, payments, attendance, notes, contactLog] = await Promise.all([
        branchId ? listClasses(branchId).catch(() => []) : Promise.resolve([]),
        branchId ? getBranch(branchId).catch(() => null) : Promise.resolve(null),
        getStudentPaymentHistory(studentData.id, branchId || undefined).catch(() => []),
        getStudentAttendanceRecords(studentData.id).catch(() => []),
        branchId ? listStudentNotes(studentData.id, branchId).catch(() => []) : Promise.resolve([]),
        branchId ? listContactLog(studentData.id, branchId).catch(() => []) : Promise.resolve([]),
      ]);
      if (myId !== loadRequestIdRef.current) return;

      setClasses(classesData);
      if (branchId && studentData.classId) {
        const classData = classesData.find((c) => c.id === studentData.classId);
        setClassName(classData?.name || "—");
      }
      if (branch) setBranchData(branch);
      setPayments(payments);
      setAttendanceRecords(attendance || []);
      setNotes(notes || []);
      setContactLogEntries(contactLog || []);
    } catch (error) {
      if (myId !== loadRequestIdRef.current) return;
      console.error("Failed to load student details:", error);
      notify.error(t("error"), t("failedToLoadStudentDetails"));
      setStudent(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "left": return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      case "suspended": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default: return "";
    }
  };

  const getAttendanceColor = (status: string) => {
    switch (status) {
      case "present": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "absent": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "late": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      default: return "";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "partial": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      default: return "";
    }
  };

  const getEffectivePaymentStatus = (payment: Payment): string => {
    if (!student) return payment.status;
    return payment.amount >= student.monthlyPayment ? "paid" : "partial";
  };

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalPending = (() => {
    if (!student) return 0;
    const enrollDate = student.enrollmentDate ? new Date(student.enrollmentDate) : new Date();
    const now = new Date();
    const monthsActive = Math.max(
      1,
      (now.getFullYear() - enrollDate.getFullYear()) * 12 +
        (now.getMonth() - enrollDate.getMonth()) + 1,
    );
    return Math.max(0, (student.monthlyPayment || 0) * monthsActive - totalPaid);
  })();

  // Build running balance for payments table (sorted chronologically)
  const paymentsWithBalance: (Payment & { runningBalance: number })[] = (() => {
    const sorted = [...payments].sort((a, b) => {
      const da = new Date(`${a.year}-${String(a.month).padStart(2,"0")}-01`);
      const db_ = new Date(`${b.year}-${String(b.month).padStart(2,"0")}-01`);
      return da.getTime() - db_.getTime();
    });
    let balance = 0;
    return sorted.map((p) => {
      balance += p.amount || 0;
      return { ...p, runningBalance: balance };
    }).reverse(); // newest first for display
  })();

  // Attendance stats
  const attendanceStats = {
    present: attendanceRecords.filter(r => r.status === "present").length,
    absent: attendanceRecords.filter(r => r.status === "absent").length,
    late: attendanceRecords.filter(r => r.status === "late").length,
    total: attendanceRecords.length,
  };
  const attendanceRate = attendanceStats.total > 0
    ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
    : 0;

  const handleEdit = () => {
    if (student) {
      setEditFormData({
        fullName: student.fullName,
        // A student with no class yet opens the form with an empty picker;
        // the save handler already refuses to submit without one.
        classId: student.classId ?? "",
        phone: student.phone,
        parentPhone: student.parentPhone,
        status: student.status,
        monthlyPayment: student.monthlyPayment?.toString() || "",
      });
      setEditDialogOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!student || !editFormData.fullName || !editFormData.classId) {
      notify.error(t("error"), t("fillRequiredFields"));
      return;
    }
    try {
      const updatedMonthlyPayment = parseInt(editFormData.monthlyPayment) || student.monthlyPayment;
      const updated = await updateStudent(student.id, {
        fullName: editFormData.fullName,
        classId: editFormData.classId,
        phone: editFormData.phone,
        parentPhone: editFormData.parentPhone,
        status: editFormData.status,
        monthlyPayment: updatedMonthlyPayment,
      });
      setStudent(updated || { ...student, ...editFormData, monthlyPayment: updatedMonthlyPayment });
      const classData = classes.find((c) => c.id === editFormData.classId);
      setClassName(classData?.name || "—");
      notify.success(t("updated"), t("studentDetailsUpdated"));
      setEditDialogOpen(false);
    } catch {
      notify.error(t("error"), t("failedToUpdateStudent"));
    }
  };

  const handleDelete = () => {
    if (!canDeleteStudents) {
      notify.error(t("permissionDenied"), t("noPermissionToDeleteStudents"));
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!student) return;
    setIsDeleteLoading(true);
    try {
      await deleteStudent(student.id);
      notify.success(t("deleted"), t("successfullyDeleted"));
      router.push(backRoute);
    } catch {
      notify.error(t("error"), t("failedToDeleteStudent"));
    } finally {
      setIsDeleteLoading(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleMarkLeft = () => {
    if (!canEditStudents) {
      notify.error(t("permissionDenied"), "You don't have permission to edit students.");
      return;
    }
    setMarkLeftConfirmOpen(true);
  };

  const confirmMarkLeft = async () => {
    if (!student || student.status === "left") return;
    setIsMarkLeftLoading(true);
    try {
      const leftDate = new Date().toISOString();
      await updateStudent(student.id, { status: "left", leftDate });
      setStudent({ ...student, status: "left", leftDate });
      notify.success(t("updated"), t("statusUpdated"));
    } catch {
      notify.error(t("error"), "Failed to update student status");
    } finally {
      setIsMarkLeftLoading(false);
      setMarkLeftConfirmOpen(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !student) return;
    const branchId = currentBranch?.id;
    if (!branchId) return;
    setIsAddingNote(true);
    try {
      const note = await addStudentNote(student.id, branchId, newNoteContent.trim());
      setNotes([note, ...notes]);
      setNewNoteContent("");
      notify.success(t("success"));
    } catch {
      notify.error(t("error"));
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!student) return;
    const branchId = currentBranch?.id;
    if (!branchId) return;
    try {
      await deleteStudentNote(student.id, branchId, noteId);
      setNotes(notes.filter((n) => n.id !== noteId));
    } catch {
      notify.error(t("error"));
    }
  };

  const handleAddContact = async () => {
    if (!student) return;
    const branchId = currentBranch?.id;
    if (!branchId) return;
    setIsAddingContact(true);
    try {
      const entry = await addContactLog(student.id, branchId, {
        contactType: contactForm.contactType,
        outcome: contactForm.outcome,
        note: contactForm.note,
        contactedAt: contactForm.contactedAt,
      });
      setContactLogEntries([entry, ...contactLogEntries]);
      setShowAddContact(false);
      setContactForm({ contactType: "call", outcome: "no_answer", note: "", contactedAt: new Date().toISOString().slice(0, 16) });
      notify.success(t("success"));
    } catch {
      notify.error(t("error"));
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleDeleteContact = async (logId: string) => {
    if (!student) return;
    const branchId = currentBranch?.id;
    if (!branchId) return;
    try {
      await deleteContactLog(student.id, branchId, logId);
      setContactLogEntries(contactLogEntries.filter((e) => e.id !== logId));
    } catch {
      notify.error(t("error"));
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "overview", label: t("overview"), icon: <Users className="w-4 h-4" /> },
    { key: "payments", label: t("paymentHistory"), icon: <DollarSign className="w-4 h-4" />, count: payments.length },
    { key: "attendance", label: t("attendanceHistory"), icon: <ClipboardList className="w-4 h-4" />, count: attendanceRecords.length },
    { key: "notes", label: t("notes"), icon: <MessageSquare className="w-4 h-4" />, count: notes.length },
    { key: "contact", label: t("contactLog"), icon: <PhoneCall className="w-4 h-4" />, count: contactLogEntries.length },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded" />
          <div>
            <Skeleton className="w-48 h-8 rounded mb-2" />
            <Skeleton className="w-32 h-4 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-28 rounded" />)}
        </div>
        <Skeleton className="h-64 w-full rounded" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">{t("noStudentsYet")}</p>
        <Button onClick={() => router.push(backRoute)} className="mt-4">{t("backToStudents")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={
          from === "class"
            ? [
                { label: t("classes"), href: "/classes" },
                { label: className || t("class"), href: backRoute },
                { label: toTitleCase(student.fullName) },
              ]
            : [
                { label: t("students"), href: "/students" },
                { label: toTitleCase(student.fullName) },
              ]
        }
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" aria-label={t("back")} onClick={() => router.push(backRoute)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <InitialsAvatar name={student.fullName} size="lg" />
          <div>
            <h1 className="text-display text-slate-900 dark:text-slate-100">
              {toTitleCase(student.fullName)}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getStatusColor(student.status)}>{t(student.status)}</Badge>
              <span className="text-slate-500 dark:text-slate-400 text-sm">{className}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {canEditStudents && (
            <>
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit2 className="w-4 h-4 mr-2" />{t("edit")}
              </Button>
              {student.status === "active" && (
                <Button variant="outline" size="sm" onClick={handleMarkLeft}>
                  <UserX className="w-4 h-4 mr-2" />{t("left")}
                </Button>
              )}
            </>
          )}
          {canDeleteStudents && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />{t("delete")}
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />{t("totalPaid")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />{t("pendingLabel")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalPending)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />{t("attendanceRate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {attendanceStats.total > 0 ? `${attendanceRate}%` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-full px-2 py-0.5">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />{t("basicInformation")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("fullName")}</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{student.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("class")}</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{className}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("status")}</p>
                <Badge className={`${getStatusColor(student.status)} mt-1`}>{t(student.status)}</Badge>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("monthlyPayment")}</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(student.monthlyPayment)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Phone className="w-5 h-5" />{t("contact")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("phone")}</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{formatPhoneNumber(student.phone)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("parentPhone")}</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{formatPhoneNumber(student.parentPhone)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" />{t("enrollmentInformation")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("enrollmentDate")}</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{formatDate(student.enrollmentDate)}</p>
              </div>
              {student.leftDate && (
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t("leftDate")}</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{formatDate(student.leftDate)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5" />{t("attendanceSummary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionErrorBoundary label={t("attendanceSummary")}>
                <AttendanceDonut
                  stats={{
                    present: attendanceStats.present,
                    absent: attendanceStats.absent,
                    late: attendanceStats.late,
                  }}
                  labels={{
                    present: t("present"),
                    absent: t("absent"),
                    late: t("late"),
                  }}
                  size={140}
                  className="justify-center"
                />
              </SectionErrorBoundary>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  {t("paymentHistory")}
                </span>
                <span className="text-xs font-normal text-slate-500">
                  {t("last6Months")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SectionErrorBoundary label={t("paymentHistory")}>
                <PaymentTrendChart
                  payments={payments}
                  targetAmount={student.monthlyPayment}
                  monthLabels={MONTH_LABELS_SHORT(t)}
                />
              </SectionErrorBoundary>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
                <LegendDot color="#10b981" label={t("paid")} />
                <LegendDot color="#f59e0b" label={t("partial")} />
                <LegendDot color="#e2e8f0" label={t("unpaid")} />
                <span className="ml-auto">
                  {t("monthlyPayment")}:{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatCurrency(student.monthlyPayment)}
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "payments" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("paymentHistory")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("period")}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("amount")}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("status")}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("paidDate")}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("runningBalance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsWithBalance.length > 0 ? (
                    paymentsWithBalance.map((payment) => (
                      <tr key={payment.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{payment.month} {payment.year}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{formatCurrency(payment.amount)}</td>
                        <td className="py-3 px-4">
                          <Badge className={getPaymentStatusColor(getEffectivePaymentStatus(payment))}>
                            {t(getEffectivePaymentStatus(payment))}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {payment.paidDate
                            ? new Date(payment.paidDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, ".")
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(payment.runningBalance)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">{t("noPayments")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "attendance" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              {t("attendanceHistory")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceRecords.length === 0 ? (
              <p className="text-center py-8 text-slate-500">{t("noAttendanceData")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("date")}</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("status")}</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("note")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((rec) => (
                      <tr key={rec.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {new Date(rec.date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, ".")}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={getAttendanceColor(rec.status)}>{t(rec.status)}</Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-sm">{rec.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "notes" && (
        <div className="space-y-4">
          {/* Add note form */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Textarea
                  placeholder={t("writeNote")}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="flex-1 min-h-[80px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddNote();
                  }}
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!newNoteContent.trim() || isAddingNote}
                  className="self-end"
                >
                  {isAddingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Ctrl+Enter to submit</p>
            </CardContent>
          </Card>

          {/* Notes list */}
          {notes.length === 0 ? (
            <div className="text-center py-8 text-slate-500">{t("noNotes")}</div>
          ) : (
            notes.map((note) => (
              <Card key={note.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <p className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{note.content}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {note.createdByName} · {new Date(note.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(/\//g, ".")}
                      </p>
                    </div>
                    {canEditStudents && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("delete")}
                        className="text-red-500 hover:text-red-600 flex-shrink-0"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === "contact" && (
        <div className="space-y-4">
          {/* Add contact button */}
          {canEditStudents && (
            <Button onClick={() => setShowAddContact(!showAddContact)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              {t("addContact")}
            </Button>
          )}

          {/* Add contact form */}
          {showAddContact && (
            <Card>
              <CardHeader>
                <CardTitle>{t("addContact")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("contactType")}</Label>
                    <Select
                      value={contactForm.contactType}
                      onValueChange={(v) => setContactForm({ ...contactForm, contactType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">{t("call")}</SelectItem>
                        <SelectItem value="message">{t("message")}</SelectItem>
                        <SelectItem value="in_person">{t("inPerson")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("outcome")}</Label>
                    <Select
                      value={contactForm.outcome}
                      onValueChange={(v) => setContactForm({ ...contactForm, outcome: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="answered">{t("answered")}</SelectItem>
                        <SelectItem value="no_answer">{t("noAnswer")}</SelectItem>
                        <SelectItem value="left_message">{t("leftMessage")}</SelectItem>
                        <SelectItem value="resolved">{t("resolved")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("contactedAt")}</Label>
                  <Input
                    type="datetime-local"
                    value={contactForm.contactedAt}
                    onChange={(e) => setContactForm({ ...contactForm, contactedAt: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("note")}</Label>
                  <Textarea
                    placeholder={t("writeNote")}
                    value={contactForm.note}
                    onChange={(e) => setContactForm({ ...contactForm, note: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowAddContact(false)}>{t("cancel")}</Button>
                  <Button onClick={handleAddContact} disabled={isAddingContact}>
                    {isAddingContact ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {t("save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact log list */}
          {contactLogEntries.length === 0 ? (
            <div className="text-center py-8 text-slate-500">{t("noContactLog")}</div>
          ) : (
            contactLogEntries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {t(entry.contactType) || entry.contactType}
                        </Badge>
                        <Badge
                          className={`text-xs ${
                            entry.outcome === "answered" || entry.outcome === "resolved"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : entry.outcome === "no_answer"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}
                        >
                          {t(entry.outcome === "no_answer" ? "noAnswer" : entry.outcome === "left_message" ? "leftMessage" : entry.outcome) || entry.outcome}
                        </Badge>
                      </div>
                      {entry.note && (
                        <p className="text-slate-700 dark:text-slate-300 text-sm mb-1">{entry.note}</p>
                      )}
                      <p className="text-xs text-slate-400">
                        {entry.createdByName} · {new Date(entry.contactedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(/\//g, ".")}
                      </p>
                    </div>
                    {canEditStudents && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("delete")}
                        className="text-red-500 hover:text-red-600 flex-shrink-0"
                        onClick={() => handleDeleteContact(entry.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Edit Student Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editStudent")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">{t("fullName")} *</Label>
              <Input
                id="edit-fullName"
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-classId">{t("selectClass")} *</Label>
              <Select
                value={editFormData.classId}
                onValueChange={(value) => setEditFormData({ ...editFormData, classId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectClass")} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">{t("phone")} *</Label>
              <Input id="edit-phone" type="tel" value={editFormData.phone}
                placeholder="+998 XX XXX-XX-XX"
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-parentPhone">{t("parentPhone")} *</Label>
              <Input id="edit-parentPhone" type="tel" value={editFormData.parentPhone}
                placeholder="+998 XX XXX-XX-XX"
                onChange={(e) => setEditFormData({ ...editFormData, parentPhone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">{t("status")} *</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value: Student["status"]) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("active")}</SelectItem>
                  <SelectItem value="suspended">{t("suspended")}</SelectItem>
                  <SelectItem value="left">{t("left")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-monthlyPayment">{t("monthlyPayment")} *</Label>
              <Input id="edit-monthlyPayment" type="number" min="0" step="500"
                value={editFormData.monthlyPayment}
                onChange={(e) => setEditFormData({ ...editFormData, monthlyPayment: e.target.value })}
                placeholder="0" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleSaveEdit}>{t("update")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("confirmDelete")}</DialogTitle></DialogHeader>
          <p className="text-slate-600 dark:text-slate-400">{t("confirmDeleteStudent")}</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleteLoading}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleteLoading}>
              {isDeleteLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("deleting")}</> : t("delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark Left Confirmation Dialog */}
      <Dialog open={markLeftConfirmOpen} onOpenChange={setMarkLeftConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("confirm")}</DialogTitle></DialogHeader>
          <p className="text-slate-600 dark:text-slate-400">{t("confirmMarkLeft")}</p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-900 dark:text-blue-100">{t("willStopPaymentTracking")}</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setMarkLeftConfirmOpen(false)} disabled={isMarkLeftLoading}>{t("cancel")}</Button>
            <Button onClick={confirmMarkLeft} disabled={isMarkLeftLoading}>
              {isMarkLeftLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("updating")}</> : t("confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
