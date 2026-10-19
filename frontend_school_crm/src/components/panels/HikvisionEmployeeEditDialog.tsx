// Add or edit a Face ID employee — one dialog for both, so they look the same:
// photo with live preview, display name, linked teacher. Adding requires a photo
// (the terminal recognises people by face); editing makes it optional.
import { useEffect, useMemo, useState } from "react";
import { Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useToast } from "@/hooks/use-toast";
import { addHikvisionEmployee, updateHikvisionEmployee, uploadHikvisionEmployeeFace } from "@/lib/api";
import { validateFacePhoto } from "@/lib/face-photo";
import { HikvisionEmployee, Teacher } from "@/types";

interface Props {
  /** Editing this employee… */
  employee: HikvisionEmployee | null;
  /** …or, when set (and employee is null), adding a new one to this device. */
  createDeviceId?: string | null;
  teachers: Teacher[];
  t: (key: string) => string;
  onClose: () => void;
  onSaved: () => void;
}

export function HikvisionEmployeeEditDialog({ employee, createDeviceId, teachers, t, onClose, onSaved }: Props) {
  const creating = !employee && !!createDeviceId;
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [teacherId, setTeacherId] = useState("none");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(employee?.fullName ?? "");
    setTeacherId(employee?.teacherId || "none");
    setPhoto(null);
    setPhotoError("");
  }, [employee, createDeviceId]);

  const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const pickPhoto = async (file: File | null) => {
    setPhoto(null);
    setPhotoError("");
    if (!file) return;
    const problem = await validateFacePhoto(file);
    if (problem) setPhotoError(t(problem));
    else setPhoto(file);
  };

  const shownPhoto = previewUrl || employee?.photoUrl || "";
  const unchanged =
    !creating &&
    !!employee &&
    fullName.trim() === employee.fullName &&
    (teacherId === "none" ? "" : teacherId) === (employee.teacherId || "") &&
    !photo;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    if (creating && !photo) {
      setPhotoError(t("facePhotoRequiredError"));
      return;
    }
    setSaving(true);
    try {
      if (creating && createDeviceId && photo) {
        await addHikvisionEmployee({
          deviceId: createDeviceId,
          fullName: fullName.trim(),
          teacherId: teacherId === "none" ? null : teacherId,
          photo,
        });
        toast({ title: t("success"), description: t("employeeAdded"), variant: "success" });
      } else if (employee) {
        await updateHikvisionEmployee(employee.id, {
          fullName: fullName.trim(),
          teacherId: teacherId === "none" ? null : teacherId,
        });
        if (photo) await uploadHikvisionEmployeeFace(employee.id, photo);
        toast({ title: t("success"), description: t("employeeUpdated"), variant: "success" });
      }
      onSaved();
      onClose();
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t(creating ? "failedToAddEmployee" : "failedToUpdateEmployee"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!employee || creating} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{creating ? t("addNewEmployee") : t("editEmployee")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-24 w-24 rounded-xl">
              {shownPhoto && <AvatarImage src={shownPhoto} alt={fullName} className="object-cover" />}
              <AvatarFallback className="rounded-xl">
                <User className="w-8 h-8 text-slate-400" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <Label htmlFor="editEmployeePhoto">{creating ? t("facePhotoRequired") : t("changePhotoOptional")}</Label>
              <Input
                id="editEmployeePhoto"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
              />
              {photoError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">{photoError}</p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {creating || employee?.photoUrl ? t("facePhotoRequiredHint") : t("noPhotoYetHint")}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editEmployeeName">{t("fullName")} *</Label>
            <Input
              id="editEmployeeName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {creating ? t("employeeNoAuto") : `${t("employeeNo")}: ${employee?.employeeNo}`}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("linkedTeacherOptional")}</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noneOption")}</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving || unchanged || !fullName.trim() || (creating && !photo)}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {creating ? t("create") : t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
