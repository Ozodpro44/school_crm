import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { useNotify } from "@/hooks/use-notify";
import {
  listSchedule,
  upsertScheduleSlot,
  deleteScheduleSlot,
  listClasses,
  listTeachers,
  ScheduleSlot,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Trash2, Calendar, Clock, BookOpen } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useBranch } from "@/context/BranchContext";

const DAYS = [
  { num: 1, key: "monday" },
  { num: 2, key: "tuesday" },
  { num: 3, key: "wednesday" },
  { num: 4, key: "thursday" },
  { num: 5, key: "friday" },
  { num: 6, key: "saturday" },
];

const DAY_COLORS = [
  "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
  "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
  "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
  "bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800",
  "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800",
];

export default function SchedulePage() {
  const language = useLanguage();
  const { currentBranch } = useBranch();

  const [isLoading, setIsLoading] = useState(true);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    classId: "",
    teacherId: "none",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:00",
    room: "",
    subject: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const t = (key: string) => getTranslation(key, language);
  const notify = useNotify();

  useEffect(() => {
    if (!currentBranch?.id) return;
    loadData();
  }, [currentBranch?.id]);

  const loadData = async () => {
    const branchId = currentBranch?.id;
    if (!branchId) return;
    setIsLoading(true);
    try {
      const [slotsData, classesData, teachersData] = await Promise.all([
        listSchedule(branchId),
        listClasses(branchId),
        listTeachers(branchId),
      ]);
      setSlots(slotsData);
      setClasses(classesData);
      setTeachers(teachersData);
      if (classesData.length > 0 && form.classId === "") {
        setForm((f) => ({ ...f, classId: classesData[0]!.id }));
      }
    } catch {
      notify.error(t("error"));
    } finally {
      setIsLoading(false);
    }
  };

  const openAdd = () => {
    setForm({
      classId: classes[0]?.id || "",
      teacherId: "none",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      room: "",
      subject: "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const branchId = currentBranch?.id;
    if (!branchId || !form.classId) return;
    setIsSaving(true);
    try {
      const slot = await upsertScheduleSlot({
        branchId,
        classId: form.classId,
        teacherId: form.teacherId !== "none" ? form.teacherId : undefined,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room,
        subject: form.subject,
      });
      setSlots((prev) => {
        const idx = prev.findIndex(
          (s) => s.classId === slot.classId && s.dayOfWeek === slot.dayOfWeek && s.startTime === slot.startTime
        );
        return idx >= 0 ? prev.map((s, i) => (i === idx ? slot : s)) : [...prev, slot];
      });
      notify.success(t("success"));
      setDialogOpen(false);
    } catch {
      notify.error(t("error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (slot: ScheduleSlot) => {
    const branchId = currentBranch?.id;
    if (!branchId) return;
    try {
      await deleteScheduleSlot(slot.id, branchId);
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
    } catch {
      notify.error(t("error"));
    }
  };

  const filteredSlots = selectedClassId === "all"
    ? slots
    : slots.filter((s) => s.classId === selectedClassId);

  const className = (classId: string) =>
    classes.find((c) => c.id === classId)?.name || "—";

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center gap-4">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-44 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>
        </div>
        {/* Weekly grid — 6 day columns, each with a header + 3 slot cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-9 w-full rounded-lg" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-display text-slate-900 dark:text-slate-100">
            {t("timetable")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t("schedule")}</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allClasses")}</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            {t("addSlot")}
          </Button>
        </div>
      </div>

      {/* Weekly Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {DAYS.map((day, di) => {
          const daySlots = filteredSlots
            .filter((s) => s.dayOfWeek === day.num)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div key={day.num} className="space-y-2">
              <div className={`rounded-lg border p-2 text-center text-sm font-semibold ${DAY_COLORS[di]}`}>
                {t(day.key)}
              </div>
              <div className="space-y-2 min-h-[100px]">
                {daySlots.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-4">—</div>
                ) : (
                  daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`rounded-lg border p-2 text-xs space-y-1 ${DAY_COLORS[di]}`}
                    >
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {slot.subject || className(slot.classId)}
                      </div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3 h-3" />
                        {slot.startTime}–{slot.endTime}
                      </div>
                      {slot.room && (
                        <div className="text-slate-500 truncate">📍 {slot.room}</div>
                      )}
                      {slot.teacherName && (
                        <div className="text-slate-500 truncate">👤 {slot.teacherName}</div>
                      )}
                      {selectedClassId === "all" && (
                        <div className="text-slate-500 truncate">
                          <BookOpen className="w-3 h-3 inline mr-1" />
                          {className(slot.classId)}
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-5 h-5 text-red-400 hover:text-red-600"
                        onClick={() => handleDelete(slot)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredSlots.length === 0 && !isLoading && (
        <Card>
          <CardContent className="pt-2">
            <EmptyState
              icon={Calendar}
              title={t("noData")}
              description={t("addSlotHint")}
              action={{ label: t("addSlot"), onClick: openAdd }}
            />
          </CardContent>
        </Card>
      )}

      {/* Add Slot Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addSlot")}</DialogTitle>
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

            <div className="space-y-2">
              <Label>{t("day")} *</Label>
              <Select
                value={String(form.dayOfWeek)}
                onValueChange={(v) => setForm({ ...form, dayOfWeek: parseInt(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => <SelectItem key={d.num} value={String(d.num)}>{t(d.key)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("startTime")} *</Label>
                <Input type="time" value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("endTime")} *</Label>
                <Input type="time" value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("subject")}</Label>
              <Input placeholder="Math, English…"
                value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>{t("room")}</Label>
              <Input placeholder="101, Lab A…"
                value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>{t("teacher")}</Label>
              <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectTeacher")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— {t("none")} —</SelectItem>
                  {teachers.map((t_) => <SelectItem key={t_.id} value={t_.id}>{t_.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleSave} disabled={isSaving || !form.classId}>
                {t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
