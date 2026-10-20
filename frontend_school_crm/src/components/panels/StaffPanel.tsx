// Staff (Face ID employees): who is enrolled on the branch's terminals. Add, edit
// (name, teacher link, photo) and remove. Devices are managed on the Attendance page.
import { confirmAction } from "@/lib/confirm";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, Trash2, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import {
  listHikvisionDevices,
  listHikvisionEmployees,
  removeHikvisionEmployee,
  listTeachers,
} from "@/lib/api";
import { HikvisionEmployeeEditDialog } from "@/components/panels/HikvisionEmployeeEditDialog";
import { HikvisionDevice, HikvisionEmployee, Teacher } from "@/types";

function SkeletonRows() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <Skeleton className="h-4 flex-1 max-w-[220px]" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function StaffPanel() {
  const { toast } = useToast();
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<HikvisionDevice[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [employees, setEmployees] = useState<HikvisionEmployee[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [editEmployee, setEditEmployee] = useState<HikvisionEmployee | null>(null);
  const [createDeviceId, setCreateDeviceId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Which device's list has finished loading: a device switch (or the first
  // load) shows skeleton rows instead of a blank card that pops into place.
  const [loadedFor, setLoadedFor] = useState("");
  const employeesLoading = deviceId !== "" && loadedFor !== deviceId;

  const getBranchId = () =>
    typeof window !== "undefined" ? localStorage.getItem("selectedBranchId") : null;

  const loadAll = async () => {
    const branchId = getBranchId();
    if (!branchId) {
      setDevices([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [deviceList, teacherList] = await Promise.all([
        listHikvisionDevices(branchId),
        listTeachers(branchId).catch(() => []),
      ]);
      setDevices(deviceList);
      setTeachers(teacherList);
      setDeviceId((prev) => (deviceList.some((d) => d.id === prev) ? prev : deviceList[0]?.id ?? ""));
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("failedToLoadDevices"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async (id: string) => {
    try {
      setEmployees(await listHikvisionEmployees(id));
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("failedToLoadEmployees"),
        variant: "destructive",
      });
    } finally {
      setLoadedFor(id);
    }
  };

  useEffect(() => {
    loadAll();
    const onBranch = () => {
      setDeviceId("");
      setLoadedFor("");
      setEmployees([]);
      loadAll();
    };
    window.addEventListener("branchChange", onBranch);
    return () => window.removeEventListener("branchChange", onBranch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (deviceId) {
      setEmployees([]);
      loadEmployees(deviceId);
    } else setEmployees([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const handleRemove = async (employee: HikvisionEmployee) => {
    if (!(await confirmAction({ description: t("confirmRemoveEmployee"), destructive: true }))) return;
    setRemovingId(employee.id);
    try {
      await removeHikvisionEmployee(employee.id);
      toast({ title: t("success"), description: t("employeeRemoved"), variant: "success" });
      await loadEmployees(deviceId);
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("failedToRemoveEmployee"),
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

  const teacherName = (id?: string | null) =>
    id ? teachers.find((tc) => tc.id === id)?.fullName ?? "—" : "—";

  // One continuous loader for the whole first load (devices, then the list):
  // two different skeletons in a row read as the page loading twice.
  if (loading || (devices.length > 0 && loadedFor === "")) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <SkeletonRows />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!getBranchId()) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-slate-500 dark:text-slate-400">
          {t("selectBranchFirst")}
        </CardContent>
      </Card>
    );
  }

  if (devices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <p className="text-slate-500 dark:text-slate-400">{t("staffNoDevices")}</p>
          <Button asChild>
            <Link href="/attendance?tab=faceid">{t("staffGoToDevices")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const th = "text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        {devices.length > 1 ? (
          <div className="w-full sm:w-72">
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
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{devices[0]?.name}</p>
        )}
        <Button className="bg-brand hover:bg-brand-hover" onClick={() => setCreateDeviceId(deviceId)} disabled={!deviceId}>
          <Plus className="w-4 h-4 mr-2" />
          {t("addEmployee")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {employeesLoading ? (
            <SkeletonRows />
          ) : employees.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">{t("noEmployeesYet")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className={th}>{t("fullName")}</th>
                    <th className={th}>{t("employeeNo")}</th>
                    <th className={th}>{t("teacher")}</th>
                    <th className={`${th} text-right`}>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            {employee.photoUrl && (
                              <AvatarImage src={employee.photoUrl} alt={employee.fullName} className="object-cover" />
                            )}
                            <AvatarFallback>
                              <User className="w-4 h-4 text-slate-400" />
                            </AvatarFallback>
                          </Avatar>
                          {employee.fullName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{employee.employeeNo}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{teacherName(employee.teacherId)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t("editEmployee")}
                            title={t("editEmployee")}
                            onClick={() => setEditEmployee(employee)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t("delete")}
                            onClick={() => handleRemove(employee)}
                            disabled={removingId === employee.id}
                          >
                            {removingId === employee.id ? (
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
            </div>
          )}
        </CardContent>
      </Card>

      <HikvisionEmployeeEditDialog
        employee={editEmployee}
        createDeviceId={createDeviceId}
        teachers={teachers}
        t={t}
        onClose={() => {
          setEditEmployee(null);
          setCreateDeviceId(null);
        }}
        onSaved={() => loadEmployees(deviceId)}
      />
    </div>
  );
}
