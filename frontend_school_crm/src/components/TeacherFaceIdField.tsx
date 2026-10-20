// Optional "Face ID" block of the add-teacher form (admins only): a face photo
// that, when given, also enrols the teacher on the branch's terminal so one
// submit creates both. Renders nothing when the branch has no terminal.
import { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listHikvisionDevices } from "@/lib/api";
import { validateFacePhoto } from "@/lib/face-photo";
import { HikvisionDevice } from "@/types";

export interface FaceIdSelection {
  deviceId: string;
  photo: File;
}

interface Props {
  branchId: string;
  t: (key: string) => string;
  onChange: (selection: FaceIdSelection | null) => void;
}

export function TeacherFaceIdField({ branchId, t, onChange }: Props) {
  const [devices, setDevices] = useState<HikvisionDevice[] | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listHikvisionDevices(branchId)
      .then((list) => {
        if (cancelled) return;
        setDevices(list);
        setDeviceId(list[0]?.id ?? "");
      })
      .catch(() => !cancelled && setDevices([])); // not an admin, or no access: simply hide the block
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  useEffect(() => {
    onChange(photo && deviceId ? { deviceId, photo } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, deviceId]);

  const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const pick = async (file: File | null) => {
    setPhoto(null);
    setError("");
    if (!file) return;
    const problem = await validateFacePhoto(file);
    if (problem) setError(t(problem));
    else setPhoto(file);
  };

  if (!devices || devices.length === 0) return null;

  return (
    <div className="md:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t("teacherFaceIdTitle")}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("teacherFaceIdHint")}</p>
      </div>
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 rounded-xl">
          {previewUrl && <AvatarImage src={previewUrl} alt="" className="object-cover" />}
          <AvatarFallback className="rounded-xl">
            <User className="w-7 h-7 text-slate-400" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <div className="space-y-1">
            <Label htmlFor="teacherFacePhoto">{t("facePhotoOptional")}</Label>
            <Input
              id="teacherFacePhoto"
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
            )}
          </div>
          {devices.length > 1 && (
            <Select value={deviceId} onValueChange={setDeviceId}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectDevice")} />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}
