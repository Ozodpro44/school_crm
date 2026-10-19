// Monthly Face ID attendance report per person (teachers first).
import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Loader2, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatTimeInTashkent } from "@/lib/timezone";
import { getHikvisionAttendanceReport } from "@/lib/api";
import { HikvisionEmployeeReport } from "@/types";

const hhmm = (minutes: number) =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

// "4 daq" / "1 s 20 daq": H:MM alone is ambiguous ("0:04" reads like a time of day).
const duration = (minutes: number, h: string, m: string) => {
  if (minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return [hours > 0 ? `${hours} ${h}` : "", mins > 0 || hours === 0 ? `${mins} ${m}` : ""].filter(Boolean).join(" ");
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function HikvisionReport() {
  const { toast } = useToast();
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const [month, setMonth] = useState(currentMonth());
  const [lateAfter, setLateAfter] = useState("08:30");
  const [teachersOnly, setTeachersOnly] = useState(true);
  const [rows, setRows] = useState<HikvisionEmployeeReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!month || !/^\d{2}:\d{2}$/.test(lateAfter)) return;
    let cancelled = false;
    setLoading(true);
    getHikvisionAttendanceReport(month, lateAfter)
      .then((data) => !cancelled && setRows(data))
      .catch((error) => {
        if (cancelled) return;
        setRows([]);
        toast({
          title: t("error"),
          description: error instanceof Error ? error.message : t("failedToLoadReport"),
          variant: "destructive",
        });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, lateAfter]);

  const visible = useMemo(
    () => (teachersOnly ? rows.filter((r) => r.teacherId) : rows),
    [rows, teachersOnly]
  );

  const exportCsv = () => {
    const header = [
      t("fullName"),
      t("teacher"),
      t("employeeNo"),
      t("reportDaysPresent"),
      t("reportLateDays"),
      t("reportTotalHours"),
      t("reportAvgIn"),
    ];
    const lines = visible.map((r) =>
      [
        r.fullName,
        r.teacherName ?? "",
        r.employeeNo,
        r.daysPresent,
        r.lateDays,
        hhmm(r.totalMinutes),
        r.avgInMinute != null ? hhmm(r.avgInMinute) : "",
      ]
        .map(csvCell)
        .join(",")
    );
    const blob = new Blob(["﻿" + [header.map(csvCell).join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const th = "text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="reportMonth">{t("reportMonth")}</Label>
              <Input
                id="reportMonth"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportLateAfter">{t("reportLateAfter")}</Label>
              <Input
                id="reportLateAfter"
                type="time"
                value={lateAfter}
                onChange={(e) => setLateAfter(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch id="reportTeachersOnly" checked={teachersOnly} onCheckedChange={setTeachersOnly} />
              <Label htmlFor="reportTeachersOnly">{t("reportTeachersOnly")}</Label>
            </div>
            <Button
              variant="outline"
              className="sm:ml-auto"
              onClick={exportCsv}
              disabled={visible.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              {t("reportExport")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              {teachersOnly && rows.length > 0 ? t("reportNoTeachers") : t("reportEmpty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className={th} />
                    <th className={th}>{t("fullName")}</th>
                    <th className={th}>{t("reportDaysPresent")}</th>
                    <th className={th}>{t("reportLateDays")}</th>
                    <th className={th}>{t("reportTotalHours")}</th>
                    <th className={th}>{t("reportAvgIn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const open = expanded === r.employeeId;
                    return (
                      <Fragment key={r.employeeId}>
                        <tr
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer"
                          onClick={() => setExpanded(open ? null : r.employeeId)}
                        >
                          <td className="py-3 pl-4 w-8 text-slate-400">
                            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                {r.photoUrl && <AvatarImage src={r.photoUrl} alt={r.fullName} className="object-cover" />}
                                <AvatarFallback>
                                  <User className="w-4 h-4 text-slate-400" />
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                {r.teacherName ?? r.fullName}
                                {r.teacherName && r.teacherName !== r.fullName && (
                                  <span className="block text-xs font-normal text-slate-500">{r.fullName}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 tabular-nums">{r.daysPresent}</td>
                          <td className="py-3 px-4 tabular-nums">
                            {r.lateDays > 0 ? (
                              <Badge variant="destructive">{r.lateDays}</Badge>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 tabular-nums">{duration(r.totalMinutes, t("reportHourShort"), t("reportMinuteShort"))}</td>
                          <td className="py-3 px-4 tabular-nums">
                            {r.avgInMinute != null ? hhmm(r.avgInMinute) : "—"}
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50/60 dark:bg-slate-900/40">
                            <td />
                            <td colSpan={5} className="px-4 py-3">
                              {r.days.length === 0 ? (
                                <span className="text-sm text-slate-500">{t("reportNoDays")}</span>
                              ) : (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-slate-500">
                                      <th className="text-left py-1 pr-4 font-medium">{t("date")}</th>
                                      <th className="text-left py-1 pr-4 font-medium">{t("reportFirstIn")}</th>
                                      <th className="text-left py-1 pr-4 font-medium">{t("reportLastOut")}</th>
                                      <th className="text-left py-1 font-medium">{t("reportHours")}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.days.map((d) => (
                                      <tr key={d.date}>
                                        <td className="py-1 pr-4 tabular-nums">{d.date}</td>
                                        <td className="py-1 pr-4 tabular-nums">
                                          {formatTimeInTashkent(d.firstIn)}
                                          {d.late && (
                                            <Badge variant="destructive" className="ml-2">
                                              {t("reportLate")}
                                            </Badge>
                                          )}
                                        </td>
                                        <td className="py-1 pr-4 tabular-nums">
                                          {d.events >= 2 ? formatTimeInTashkent(d.lastOut) : "—"}
                                        </td>
                                        <td className="py-1 tabular-nums">
                                          {d.events >= 2 ? duration(d.minutes, t("reportHourShort"), t("reportMinuteShort")) : "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
