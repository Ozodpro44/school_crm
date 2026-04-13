import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { apiRequest, listClasses, listStudents } from "@/lib/api";
import type { Class, Student } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  AlertTriangle,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = "present" | "absent" | "late";

interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  note?: string;
}

interface AttendanceResponse {
  id: string;
  studentId: string;
  status: AttendanceStatus;
  date: string;
  studentName?: string;
}

interface MonthSummary {
  studentId: string;
  studentName: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  presentPct: number;
}

interface AbsenceAlert {
  studentId: string;
  studentName: string;
  absent: number;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchAttendance(classId: string, date: string): Promise<AttendanceResponse[]> {
  return apiRequest<AttendanceResponse[]>(`/attendance?classId=${classId}&date=${date}`);
}

async function saveAttendance(payload: {
  branchId: string;
  classId: string;
  date: string;
  records: AttendanceRecord[];
}): Promise<{ saved: number }> {
  return apiRequest<{ saved: number }>("/attendance", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function fetchMonthSummary(classId: string, year: number, month: number): Promise<MonthSummary[]> {
  return apiRequest<MonthSummary[]>(`/attendance/summary?classId=${classId}&year=${year}&month=${month}`);
}

async function fetchAbsenceAlerts(branchId: string): Promise<AbsenceAlert[]> {
  return apiRequest<AbsenceAlert[]>(`/attendance/alerts?branchId=${branchId}`);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string, lang: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(lang === "en" ? "en-US" : "ru-RU", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Status button ────────────────────────────────────────────────────────────

function StatusButton({
  status,
  current,
  onClick,
  label,
}: {
  status: AttendanceStatus;
  current: AttendanceStatus;
  onClick: () => void;
  label: string;
}) {
  const active = status === current;
  const colors: Record<AttendanceStatus, string> = {
    present: active
      ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600"
      : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950",
    absent: active
      ? "bg-red-500 text-white border-red-500 hover:bg-red-600"
      : "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950",
    late: active
      ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
      : "border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950",
  };
  const icons: Record<AttendanceStatus, React.ReactNode> = {
    present: <CheckCircle2 className="w-3.5 h-3.5" />,
    absent: <XCircle className="w-3.5 h-3.5" />,
    late: <Clock className="w-3.5 h-3.5" />,
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
        colors[status]
      )}
    >
      {icons[status]}
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AttendancePage() {
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const { currentBranch } = useBranch();
  const { toast } = useToast();

  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(toDateString(new Date()));
  const [attendance, setAttendance] = useState<Map<string, AttendanceStatus>>(new Map());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [monthSummary, setMonthSummary] = useState<MonthSummary[]>([]);
  const [absenceAlerts, setAbsenceAlerts] = useState<AbsenceAlert[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"mark" | "summary" | "alerts">("mark");

  const branchId = currentBranch?.id ?? "";

  // Load classes
  useEffect(() => {
    if (!branchId) return;
    setLoadingClasses(true);
    listClasses(branchId)
      .then(setClasses)
      .catch(() => {})
      .finally(() => setLoadingClasses(false));
  }, [branchId]);

  // Load students for selected class
  useEffect(() => {
    if (!selectedClassId || !branchId) {
      setStudents([]);
      return;
    }
    listStudents(branchId, undefined, 200, { classId: selectedClassId, status: "active" })
      .then((res) => setStudents(res.data ?? []))
      .catch(() => setStudents([]));
  }, [selectedClassId, branchId]);

  // Load existing attendance when class+date changes
  useEffect(() => {
    if (!selectedClassId || !selectedDate) return;
    setLoadingAttendance(true);
    fetchAttendance(selectedClassId, selectedDate)
      .then((records) => {
        const map = new Map<string, AttendanceStatus>();
        records.forEach((r) => map.set(r.studentId, r.status));
        setAttendance(map);
      })
      .catch(() => {})
      .finally(() => setLoadingAttendance(false));
  }, [selectedClassId, selectedDate]);

  // Load month summary
  const loadSummary = useCallback(() => {
    if (!selectedClassId) return;
    const d = new Date(selectedDate);
    fetchMonthSummary(selectedClassId, d.getFullYear(), d.getMonth() + 1)
      .then(setMonthSummary)
      .catch(() => setMonthSummary([]));
  }, [selectedClassId, selectedDate]);

  useEffect(() => {
    if (activeTab === "summary") loadSummary();
  }, [activeTab, loadSummary]);

  // Load absence alerts
  useEffect(() => {
    if (activeTab === "alerts" && branchId) {
      fetchAbsenceAlerts(branchId)
        .then(setAbsenceAlerts)
        .catch(() => setAbsenceAlerts([]));
    }
  }, [activeTab, branchId]);

  // Default all students to "present" when the class/students list loads and no data yet
  useEffect(() => {
    if (students.length === 0) return;
    setAttendance((prev) => {
      const next = new Map(prev);
      students.forEach((s) => {
        if (!next.has(s.id)) next.set(s.id, "present");
      });
      return next;
    });
  }, [students]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendance((prev) => new Map(prev).set(studentId, status));
  };

  const handleSave = async () => {
    if (!selectedClassId || !branchId) return;
    setSaving(true);
    try {
      const records: AttendanceRecord[] = students.map((s) => ({
        studentId: s.id,
        status: attendance.get(s.id) ?? "present",
        note: notes.get(s.id) || undefined,
      }));
      const res = await saveAttendance({ branchId, classId: selectedClassId, date: selectedDate, records });
      toast({ title: t("attendanceSaved"), description: `${res.saved} ${t("students").toLowerCase()}` });
      if (activeTab === "summary") loadSummary();
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(toDateString(d));
  };

  // Summary: count by status for current view
  const presentCount = students.filter((s) => attendance.get(s.id) === "present").length;
  const absentCount  = students.filter((s) => attendance.get(s.id) === "absent").length;
  const lateCount    = students.filter((s) => attendance.get(s.id) === "late").length;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t("attendance")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {currentBranch?.name}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
            {(["mark", "summary", "alerts"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                )}
              >
                {tab === "mark"    ? t("markAttendance")   :
                 tab === "summary" ? t("attendanceSummary") :
                                    t("absenceAlert")}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Class selector */}
          <div className="w-56">
            {loadingClasses ? (
              <Skeleton className="h-9 w-full rounded-lg" />
            ) : (
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={t("classes")} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm bg-transparent text-slate-700 dark:text-slate-200 outline-none py-1.5 px-1"
            />
            <button
              onClick={() => shiftDate(1)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              disabled={selectedDate >= toDateString(new Date())}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── TAB: Mark ── */}
        {activeTab === "mark" && (
          <div className="space-y-4">
            {!selectedClassId ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                <Users className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm">{t("selectClassAndDate")}</p>
              </div>
            ) : loadingAttendance ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                <Users className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm">{t("noStudentsInClass")}</p>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div className="flex gap-3 flex-wrap">
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {presentCount} {t("present")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950 px-3 py-1.5 rounded-lg">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                      {absentCount} {t("absent")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950 px-3 py-1.5 rounded-lg">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                      {lateCount} {t("late")}
                    </span>
                  </div>
                </div>

                {/* Student rows */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {students.map((student, idx) => {
                    const status = attendance.get(student.id) ?? "present";
                    return (
                      <div
                        key={student.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3",
                          idx === 0 && "rounded-t-2xl",
                          idx === students.length - 1 && "rounded-b-2xl"
                        )}
                      >
                        {/* Index + name */}
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-500 flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {student.fullName}
                          </p>
                          {student.phone && (
                            <p className="text-xs text-slate-400">{student.phone}</p>
                          )}
                        </div>

                        {/* Status buttons */}
                        <div className="flex gap-1.5 flex-shrink-0">
                          <StatusButton
                            status="present"
                            current={status}
                            onClick={() => handleStatusChange(student.id, "present")}
                            label={t("present")}
                          />
                          <StatusButton
                            status="late"
                            current={status}
                            onClick={() => handleStatusChange(student.id, "late")}
                            label={t("late")}
                          />
                          <StatusButton
                            status="absent"
                            current={status}
                            onClick={() => handleStatusChange(student.id, "absent")}
                            label={t("absent")}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? t("processing") : t("saveAttendance")}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB: Summary ── */}
        {activeTab === "summary" && (
          <div className="space-y-4">
            {!selectedClassId ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Users className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm">{t("selectClassAndDate")}</p>
              </div>
            ) : monthSummary.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                <p className="text-sm">{t("noStudentsInClass")}</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                        {t("students")}
                      </th>
                      <th className="text-center px-3 py-3 font-semibold text-emerald-600">{t("present")}</th>
                      <th className="text-center px-3 py-3 font-semibold text-amber-600">{t("late")}</th>
                      <th className="text-center px-3 py-3 font-semibold text-red-600">{t("absent")}</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 dark:text-slate-300">{t("attendanceRate")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {monthSummary.map((row) => (
                      <tr key={row.studentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.studentName}</td>
                        <td className="text-center px-3 py-3 text-emerald-600 font-semibold">{row.present}</td>
                        <td className="text-center px-3 py-3 text-amber-600 font-semibold">{row.late}</td>
                        <td className="text-center px-3 py-3 text-red-600 font-semibold">{row.absent}</td>
                        <td className="text-center px-3 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  row.presentPct >= 80 ? "bg-emerald-500" :
                                  row.presentPct >= 60 ? "bg-amber-500" : "bg-red-500"
                                )}
                                style={{ width: `${row.presentPct}%` }}
                              />
                            </div>
                            <span className={cn(
                              "text-xs font-semibold",
                              row.presentPct >= 80 ? "text-emerald-600" :
                              row.presentPct >= 60 ? "text-amber-600" : "text-red-600"
                            )}>
                              {Math.round(row.presentPct)}%
                            </span>
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

        {/* ── TAB: Alerts ── */}
        {activeTab === "alerts" && (
          <div className="space-y-3">
            {absenceAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                <CheckCircle2 className="w-10 h-10 mb-3 opacity-50 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {language === "uz-cyrl" ? "Hamma yaxshi" : language === "uz-latn" ? "Hamma yaxshi" : "All good — no consecutive absences"}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {language === "uz-cyrl"
                    ? "So'nggi 14 kun ichida 3 yoki undan ko'p ketma-ket kun kelmaganlar"
                    : language === "uz-latn"
                    ? "So'nggi 14 kun ichida 3 yoki undan ko'p ketma-ket kun kelmaganlar"
                    : "Students with 3+ consecutive absences in the last 14 days"}
                </p>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {absenceAlerts.map((alert) => (
                    <div key={alert.studentId} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {alert.studentName}
                        </p>
                      </div>
                      <Badge variant="destructive" className="text-xs">
                        {alert.absent} {t("daysAbsent")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
