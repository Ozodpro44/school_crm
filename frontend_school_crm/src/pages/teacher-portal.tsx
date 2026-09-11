import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { useNotify } from "@/hooks/use-notify";
import { getCurrentUser } from "@/lib/auth";
import { setStoredUser } from "@/lib/storage";
import {
  apiRequest,
  TeacherPortalStudent,
} from "@/lib/api";
import { useTeacherPortalQuery, useAttendanceMutation } from "@/hooks/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  Users,
  BookOpen,
  DollarSign,
  ClipboardList,
  Phone,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  GraduationCap,
  UserCircle,
  Edit2,
  Lock,
} from "lucide-react";
import { formatCurrency } from "@/lib/exportUtils";
import { formatPhoneNumber, toTitleCase } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";

type Tab = "classes" | "students" | "attendance" | "salary" | "profile";

export default function TeacherPortalPage() {
  const router = useRouter();
  const language = useLanguage();
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser && currentUser.role !== "teacher") {
      router.replace("/");
    }
  }, [currentUser, router]);

  const { data, isLoading, isError, refetch: refetchPortal } = useTeacherPortalQuery();
  const attendanceMutation = useAttendanceMutation();
  const [activeTab, setActiveTab] = useState<Tab>("classes");

  // Student list filters
  const [classFilter, setClassFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Profile state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Attendance state
  const [attendanceClassId, setAttendanceClassId] = useState("");
  const [attendanceMap, setAttendanceMap] = useState<Record<string, "present" | "absent" | "late">>({});
  const [attendanceNote, setAttendanceNote] = useState<Record<string, string>>({});

  const t = (key: string) => getTranslation(key, language);
  const notify = useNotify();

  // Auto-select first class for attendance when data loads
  if (data?.classes?.length && !attendanceClassId) {
    setAttendanceClassId(data.classes[0]!.id);
  }

  const filteredStudents = (data?.students ?? []).filter((s) => {
    if (classFilter !== "all" && s.classId !== classFilter) return false;
    if (paymentFilter !== "all" && s.paymentStatus !== paymentFilter) return false;
    if (search && !s.fullName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const studentsForAttendance = (data?.students ?? []).filter(
    (s) => s.classId === attendanceClassId,
  );

  const handleAttendanceToggle = (studentId: string, status: "present" | "absent" | "late") => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSaveAttendance = async () => {
    if (!attendanceClassId || studentsForAttendance.length === 0) return;
    const branchId = data?.teacher?.branchId;
    if (!branchId) return;

    const today = new Date().toISOString().slice(0, 10);
    const records = studentsForAttendance.map((s) => ({
      studentId: s.id,
      status: attendanceMap[s.id] || "absent",
      note: attendanceNote[s.id] || undefined,
    }));

    attendanceMutation.mutate(
      { branchId, classId: attendanceClassId, date: today, records },
      {
        onSuccess: () => notify.success(t("attendanceSaved")),
        onError: () => notify.error(t("error")),
      }
    );
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{t("paid")}</Badge>;
      case "partial":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{t("partial")}</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{t("unpaid")}</Badge>;
    }
  };

  const getSalaryBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{t("paid")}</Badge>;
      case "partial":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{t("partial")}</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{t("pending")}</Badge>;
    }
  };

  const handleOpenEditProfile = () => {
    setProfileForm({ fullName: data?.teacher?.fullName ?? "" });
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser || !data?.teacher) return;
    setIsSavingProfile(true);
    try {
      await apiRequest(`/users/${currentUser.id}`, {
        method: "PUT",
        body: JSON.stringify({ full_name: profileForm.fullName }),
      });
      // Sync canonical storage so the sidebar name updates
      const updated = { ...currentUser, fullName: profileForm.fullName };
      setStoredUser(updated as unknown as Parameters<typeof setStoredUser>[0]);
      window.dispatchEvent(new CustomEvent("userProfileUpdated", { detail: updated }));
      setIsEditProfileOpen(false);
      await refetchPortal();
      notify.success(t("profileUpdated"));
    } catch (error) {
      notify.error(t("error"), (error as Error).message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentUser) return;
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      notify.error(t("error"), t("passwordMismatch"));
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      notify.error(t("error"), t("passwordTooShort"));
      return;
    }
    setIsSavingProfile(true);
    try {
      await apiRequest(`/users/${currentUser.id}`, {
        method: "PUT",
        body: JSON.stringify({ current_password: passwordForm.currentPassword, password: passwordForm.newPassword }),
      });
      setIsChangePasswordOpen(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      notify.success(t("passwordUpdated"));
    } catch (error) {
      notify.error(t("error"), (error as Error).message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "classes",    label: t("myClasses"),      icon: <BookOpen className="w-4 h-4" /> },
    { key: "students",   label: t("myStudents"),     icon: <Users className="w-4 h-4" /> },
    { key: "attendance", label: t("todayAttendance"), icon: <ClipboardList className="w-4 h-4" /> },
    { key: "salary",     label: t("mySalary"),       icon: <DollarSign className="w-4 h-4" /> },
    { key: "profile",    label: t("myProfile"), icon: <UserCircle className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  // A network/auth failure previously fell through to the same "no teacher
  // record linked" message as a genuinely unlinked account — misleading a
  // teacher whose account is fine but hit a transient error, with no way to
  // retry short of a full page reload.
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
        <GraduationCap className="w-16 h-16 text-red-300" />
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">{t("error")}</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">{t("failedToLoadTeacherPortal")}</p>
        <Button onClick={() => refetchPortal()}>{t("tryAgain")}</Button>
      </div>
    );
  }

  // No teacher record linked
  if (!data?.teacher) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
        <GraduationCap className="w-16 h-16 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">{t("noTeacherRecord")}</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">{t("noTeacherRecordDesc")}</p>
      </div>
    );
  }

  const teacher = data.teacher;
  const paidCount = data.students.filter((s) => s.paymentStatus === "paid").length;
  const unpaidCount = data.students.filter((s) => s.paymentStatus !== "paid").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display text-slate-900 dark:text-slate-100">
          {t("teacherPortal")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {toTitleCase(teacher.fullName)}
          {teacher.subjects?.length > 0 && (
            <span className="ml-2 text-sm">· {teacher.subjects.join(", ")}</span>
          )}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />{t("myClasses")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{data.classes.length}</div>
            <p className="text-sm text-slate-500 mt-1">{t("studentCount")}: {data.students.length}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />{t("paid")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{paidCount}</div>
            <p className="text-sm text-slate-500 mt-1">{t("unpaid")}: {unpaidCount}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />{t("mySalary")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(data.salary?.monthlySalary ?? teacher.monthlySalary)}
            </div>
            {data.salary && (
              <div className="flex items-center gap-2 mt-1">
                {getSalaryBadge(data.salary.status)}
                <span className="text-xs text-slate-400">{data.salary.month} {data.salary.year}</span>
              </div>
            )}
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
            </button>
          ))}
        </nav>
      </div>

      {/* Classes tab */}
      {activeTab === "classes" && (
        <div>
          {data.classes.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No classes assigned"
              description="You haven't been assigned to any classes yet. Contact your branch admin."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.classes.map((cls) => {
                const classStudents = data.students.filter((s) => s.classId === cls.id);
                const classPaid = classStudents.filter((s) => s.paymentStatus === "paid").length;
                const classUnpaid = classStudents.filter((s) => s.paymentStatus !== "paid").length;
                return (
                  <Card key={cls.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-500" />
                        {cls.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">{t("studentCount")}</span>
                        <span className="font-semibold">{cls.studentCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">{t("paid")}</span>
                        <span className="font-semibold text-green-600">{classPaid}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">{t("unpaid")}</span>
                        <span className="font-semibold text-red-600">{classUnpaid}</span>
                      </div>
                      {cls.studentCount > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-slate-400 mb-1">{Math.round((classPaid / cls.studentCount) * 100)}% {t("paid")}</div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                            <div
                              className="bg-green-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.round((classPaid / cls.studentCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => {
                          setAttendanceClassId(cls.id);
                          setActiveTab("attendance");
                        }}
                      >
                        <ClipboardList className="w-4 h-4 mr-2" />
                        {t("markAttendance")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Students tab */}
      {activeTab === "students" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t("search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t("filterByClass")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allClasses")}</SelectItem>
                {data.classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder={t("paymentStatusFilter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                <SelectItem value="paid">{t("paid")}</SelectItem>
                <SelectItem value="partial">{t("partial")}</SelectItem>
                <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("fullName")}</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("class")}</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("phone")}</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("monthlyPayment")}</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">{t("noData")}</td>
                      </tr>
                    ) : (
                      filteredStudents.map((s) => (
                        <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{toTitleCase(s.fullName)}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{s.className}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            <a href={`tel:${s.phone}`} className="flex items-center gap-1 hover:text-blue-500">
                              <Phone className="w-3 h-3" />
                              {formatPhoneNumber(s.phone)}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {formatCurrency(s.monthlyPayment)}
                            {s.paidAmount > 0 && s.paidAmount < s.monthlyPayment && (
                              <span className="text-xs text-orange-500 ml-1">({formatCurrency(s.paidAmount)} paid)</span>
                            )}
                          </td>
                          <td className="py-3 px-4">{getPaymentBadge(s.paymentStatus)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance tab */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <Select value={attendanceClassId} onValueChange={setAttendanceClassId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t("selectClass")} />
                </SelectTrigger>
                <SelectContent>
                  {data.classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-slate-500">
                {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
            </div>
            <Button
              onClick={handleSaveAttendance}
              disabled={attendanceMutation.isPending || studentsForAttendance.length === 0}
            >
              {attendanceMutation.isPending ? t("processing") : t("saveAttendance")}
            </Button>
          </div>

          {studentsForAttendance.length === 0 ? (
            <EmptyState
              icon={data.classes.length === 0 ? BookOpen : Users}
              title={data.classes.length === 0 ? (t("noClassesAssigned")) : (!attendanceClassId ? (t("selectClass")) : (t("noStudentsInClass")))}
              description={data.classes.length === 0 ? (t("noClassesAssignedDesc")) : (!attendanceClassId ? (t("selectClassToMark")) : undefined)}
            />
          ) : (
            <div className="space-y-2">
              {/* Legend */}
              <div className="flex gap-3 text-xs text-slate-500 mb-3">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />{t("present")}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />{t("absent")}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />{t("late")}</span>
              </div>

              {studentsForAttendance.map((s) => {
                const status = attendanceMap[s.id];
                return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      status === "present"
                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                        : status === "absent"
                        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                        : status === "late"
                        ? "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {toTitleCase(s.fullName)}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={status === "present" ? "default" : "outline"}
                        className={status === "present" ? "bg-green-600 hover:bg-green-700" : ""}
                        onClick={() => handleAttendanceToggle(s.id, "present")}
                      >
                        {t("present")}
                      </Button>
                      <Button
                        size="sm"
                        variant={status === "late" ? "default" : "outline"}
                        className={status === "late" ? "bg-orange-500 hover:bg-orange-600" : ""}
                        onClick={() => handleAttendanceToggle(s.id, "late")}
                      >
                        {t("late")}
                      </Button>
                      <Button
                        size="sm"
                        variant={status === "absent" ? "default" : "outline"}
                        className={status === "absent" ? "bg-red-600 hover:bg-red-700" : ""}
                        onClick={() => handleAttendanceToggle(s.id, "absent")}
                      >
                        {t("absent")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Salary tab */}
      {activeTab === "salary" && (
        <div className="max-w-md space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {t("mySalary")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">{t("expectedSalary")}</span>
                <span className="font-semibold text-lg">{formatCurrency(teacher.monthlySalary)}</span>
              </div>
              {data.salary && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">{t("salaryStatus")}</span>
                    <div className="flex items-center gap-2">
                      {getSalaryBadge(data.salary.status)}
                    </div>
                  </div>
                  {data.salary.amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{t("amountPaid")}</span>
                      <span className="font-semibold text-green-600">{formatCurrency(data.salary.amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">{t("period")}</span>
                    <span className="font-medium">{data.salary.month} {data.salary.year}</span>
                  </div>
                </>
              )}

              {(!data.salary || data.salary.status !== "paid") && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {t("teacherSalaryPaymentsDue")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact info card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("basicInformation")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">{t("phone")}</p>
                <p className="font-medium">{formatPhoneNumber(teacher.phone)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="font-medium">{teacher.email}</p>
              </div>
              {teacher.joinedDate && (
                <div>
                  <p className="text-sm text-slate-500">{t("enrollmentDate")}</p>
                  <p className="font-medium">
                    {new Date(teacher.joinedDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profile tab */}
      {activeTab === "profile" && (
        <div className="max-w-md space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="w-5 h-5" />
                {t("myProfile")}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleOpenEditProfile}>
                <Edit2 className="w-4 h-4 mr-2" />
                {t("edit")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">{t("fullName")}</p>
                <p className="font-medium">{teacher.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="font-medium">{teacher.email}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">{t("phone")}</p>
                <p className="font-medium">{formatPhoneNumber(teacher.phone)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="w-4 h-4" />
                {t("changePassword")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => setIsChangePasswordOpen(true)}>
                {t("changePassword")}
              </Button>
            </CardContent>
          </Card>

          {/* Edit profile dialog */}
          <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("editProfile")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("fullName")}</Label>
                  <Input
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, fullName: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setIsEditProfileOpen(false)} disabled={isSavingProfile}>
                    {t("cancel")}
                  </Button>
                  <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                    {isSavingProfile ? t("saving") : t("save")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Change password dialog */}
          <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("changePassword")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("currentPassword")}</Label>
                  <Input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("newPassword")}</Label>
                  <Input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("confirmPassword")}</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setIsChangePasswordOpen(false)} disabled={isSavingProfile}>
                    {t("cancel")}
                  </Button>
                  <Button onClick={handleChangePassword} disabled={isSavingProfile}>
                    {isSavingProfile ? t("saving") : t("update")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
