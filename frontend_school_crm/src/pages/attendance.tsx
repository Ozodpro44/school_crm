import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { apiRequest, listClasses, listStudents } from "@/lib/api";
import type { Class, Student } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { useNotify } from "@/hooks/use-notify";
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
  CalendarDays,
  BarChart3,
  Bell,
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function AttendancePage() {
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const notify = useNotify();
  const { currentBranch } = useBranch();

  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(toDateString(new Date()));
  const [attendance, setAttendance] = useState<Map<string, AttendanceStatus>>(new Map());
  const [monthSummary, setMonthSummary] = useState<MonthSummary[]>([]);
  const [absenceAlerts, setAbsenceAlerts] = useState<AbsenceAlert[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"mark" | "summary" | "alerts">("mark");

  const branchId = currentBranch?.id ?? "";

  useEffect(() => {
    if (!branchId) return;
    setLoadingClasses(true);
    listClasses(branchId)
      .then(setClasses)
      .catch(() => {})
      .finally(() => setLoadingClasses(false));
  }, [branchId]);

  useEffect(() => {
    if (!selectedClassId || !branchId) { setStudents([]); return; }
    listStudents(branchId, undefined, 200, { classId: selectedClassId, status: "active" })
      .then((res) => setStudents(res.data ?? []))
      .catch(() => setStudents([]));
  }, [selectedClassId, branchId]);

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

  useEffect(() => {
    if (activeTab === "alerts" && branchId) {
      fetchAbsenceAlerts(branchId)
        .then(setAbsenceAlerts)
        .catch(() => setAbsenceAlerts([]));
    }
  }, [activeTab, branchId]);

  useEffect(() => {
    if (students.length === 0) return;
    setAttendance((prev) => {
      const next = new Map(prev);
      students.forEach((s) => { if (!next.has(s.id)) next.set(s.id, "present"); });
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
      }));
      const res = await saveAttendance({ branchId, classId: selectedClassId, date: selectedDate, records });
      notify.success(t("attendanceSaved"), `${res.saved} ${t("students").toLowerCase()}`);
      if (activeTab === "summary") loadSummary();
    } catch {
      notify.error(t("error"));
    } finally {
      setSaving(false);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(toDateString(d));
  };

  const presentCount = students.filter((s) => attendance.get(s.id) === "present").length;
  const absentCount  = students.filter((s) => attendance.get(s.id) === "absent").length;
  const lateCount    = students.filter((s) => attendance.get(s.id) === "late").length;

  const tabs = [
    { id: "mark"    as const, label: t("markAttendance"),    icon: CalendarDays },
    { id: "summary" as const, label: t("attendanceSummary"), icon: BarChart3 },
    { id: "alerts"  as const, label: t("absenceAlert"),      icon: Bell,
      badge: absenceAlerts.length > 0 ? absenceAlerts.length : undefined },
  ];

  return (
    <div className="space-y-6">

        {/* ── Page header ── */}
        <div>
          <h1 className="text-display text-slate-900 dark:text-slate-100">
            {t("attendance")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{currentBranch?.name}</p>
        </div>

        {/* ── Tab bar ── */}
        <div className="border-b border-slate-200 dark:border-slate-700">
          <nav className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.badge && (
                    <Badge className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs border-0 px-1.5 py-0">
                      {tab.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Controls: class + date ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="w-52">
            {loadingClasses ? (
              <Skeleton className="h-9 w-full rounded-lg" />
            ) : (
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={t("selectClass") || t("classes")} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Date navigator */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden h-9">
            <button
              onClick={() => shiftDate(-1)}
              className="px-2 h-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm bg-transparent text-slate-700 dark:text-slate-200 outline-none px-3 h-full"
            />
            <button
              onClick={() => shiftDate(1)}
              disabled={selectedDate >= toDateString(new Date())}
              className="px-2 h-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-l border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ══════════ TAB: Mark ══════════ */}
        {activeTab === "mark" && (
          <div className="space-y-4">
            {!selectedClassId ? (
              <EmptyState icon={<Users className="w-12 h-12 text-slate-300" />} text={t("selectClassAndDate")} />
            ) : loadingAttendance ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : students.length === 0 ? (
              <EmptyState icon={<Users className="w-12 h-12 text-slate-300" />} text={t("noStudentsInClass")} />
            ) : (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    count={presentCount}
                    label={t("present")}
                    colorClass="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                    icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  />
                  <StatCard
                    count={lateCount}
                    label={t("late")}
                    colorClass="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                    icon={<Clock className="w-5 h-5 text-amber-500" />}
                  />
                  <StatCard
                    count={absentCount}
                    label={t("absent")}
                    colorClass="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                    icon={<XCircle className="w-5 h-5 text-red-500" />}
                  />
                </div>

                {/* Student list */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  {students.map((student, idx) => {
                    const status = attendance.get(student.id) ?? "present";
                    return (
                      <div
                        key={student.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 transition-colors",
                          status === "present" && "bg-emerald-50/30 dark:bg-emerald-950/10",
                          status === "absent"  && "bg-red-50/30 dark:bg-red-950/10",
                          status === "late"    && "bg-amber-50/30 dark:bg-amber-950/10",
                        )}
                      >
                        <span className="w-6 text-xs text-slate-400 font-medium flex-shrink-0 text-center">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {student.fullName}
                          </p>
                        </div>

                        {/* Compact 3-segment toggle */}
                        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0">
                          <ToggleBtn
                            active={status === "present"}
                            activeClass="bg-emerald-500 text-white"
                            inactiveClass="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                            onClick={() => handleStatusChange(student.id, "present")}
                            title={t("present")}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </ToggleBtn>
                          <ToggleBtn
                            active={status === "late"}
                            activeClass="bg-amber-500 text-white"
                            inactiveClass="text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                            onClick={() => handleStatusChange(student.id, "late")}
                            title={t("late")}
                            divider
                          >
                            <Clock className="w-4 h-4" />
                          </ToggleBtn>
                          <ToggleBtn
                            active={status === "absent"}
                            activeClass="bg-red-500 text-white"
                            inactiveClass="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => handleStatusChange(student.id, "absent")}
                            title={t("absent")}
                            divider
                          >
                            <XCircle className="w-4 h-4" />
                          </ToggleBtn>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Save */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? t("processing") : t("saveAttendance")}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════ TAB: Summary ══════════ */}
        {activeTab === "summary" && (
          <div className="space-y-4">
            {!selectedClassId ? (
              <EmptyState icon={<Users className="w-12 h-12 text-slate-300" />} text={t("selectClassAndDate")} />
            ) : monthSummary.length === 0 ? (
              <EmptyState icon={<BarChart3 className="w-12 h-12 text-slate-300" />} text={t("noStudentsInClass")} />
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                          {t("students")}
                        </th>
                        <th className="text-center px-3 py-3 font-semibold text-emerald-600">{t("present")}</th>
                        <th className="text-center px-3 py-3 font-semibold text-amber-500">{t("late")}</th>
                        <th className="text-center px-3 py-3 font-semibold text-red-500">{t("absent")}</th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 min-w-[120px]">
                          {t("attendanceRate")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {monthSummary.map((row) => (
                        <tr key={row.studentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.studentName}</td>
                          <td className="text-center px-3 py-3">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
                              {row.present}
                            </span>
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold text-xs">
                              {row.late}
                            </span>
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-semibold text-xs">
                              {row.absent}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden min-w-[60px]">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    row.presentPct >= 80 ? "bg-emerald-500" :
                                    row.presentPct >= 60 ? "bg-amber-500" : "bg-red-500"
                                  )}
                                  style={{ width: `${row.presentPct}%` }}
                                />
                              </div>
                              <span className={cn(
                                "text-xs font-semibold w-9 text-right",
                                row.presentPct >= 80 ? "text-emerald-600" :
                                row.presentPct >= 60 ? "text-amber-600" : "text-red-500"
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
              </div>
            )}
          </div>
        )}

        {/* ══════════ TAB: Alerts ══════════ */}
        {activeTab === "alerts" && (
          <div className="space-y-3">
            {absenceAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {language === "en"
                    ? "All good — no consecutive absences"
                    : "Hamma yaxshi — ketma-ket qolmagan o'quvchilar yo'q"}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {language === "en"
                    ? "Students with 3+ consecutive absences in the last 14 days"
                    : "So'nggi 14 kun ichida 3 yoki undan ko'p ketma-ket kun kelmaganlar"}
                </p>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  {absenceAlerts.map((alert) => (
                    <div key={alert.studentId} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {alert.studentName}
                        </p>
                      </div>
                      <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-0 text-xs">
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
  );
}

// ─── Small reusable pieces ────────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      {icon}
      <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}

function StatCard({
  count, label, colorClass, icon,
}: {
  count: number;
  label: string;
  colorClass: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl px-4 py-3 flex items-center gap-3", colorClass)}>
      {icon}
      <div>
        <p className="text-xl font-bold leading-none">{count}</p>
        <p className="text-xs mt-0.5 opacity-75">{label}</p>
      </div>
    </div>
  );
}

function ToggleBtn({
  active, activeClass, inactiveClass, onClick, title, divider, children,
}: {
  active: boolean;
  activeClass: string;
  inactiveClass: string;
  onClick: () => void;
  title: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "px-3 py-2 transition-colors",
        divider && "border-l border-slate-200 dark:border-slate-700",
        active ? activeClass : inactiveClass
      )}
    >
      {children}
    </button>
  );
}
