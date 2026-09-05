import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Upload,
  Wifi,
  Loader2,
  Fingerprint,
  LogIn,
  LogOut as LogOutIcon,
  Search,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatDateTimeInTashkent } from "@/lib/timezone";
import {
  listHikvisionDevices,
  createHikvisionDevice,
  configureHikvisionPush,
  listHikvisionEmployees,
  addHikvisionEmployee,
  uploadHikvisionEmployeeFace,
  removeHikvisionEmployee,
  listHikvisionAttendance,
  listTeachers,
} from "@/lib/api";
import { HikvisionDevice, HikvisionEmployee, AttendanceRecord, Teacher } from "@/types";

export default function AttendancePage() {
  const router = useRouter();
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("devices");

  const [devices, setDevices] = useState<HikvisionDevice[]>([]);
  const [employees, setEmployees] = useState<HikvisionEmployee[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Attendance log filters
  const [filterDeviceId, setFilterDeviceId] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  // Add device dialog
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const [isSubmittingDevice, setIsSubmittingDevice] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    name: "",
    host: "",
    username: "admin",
    password: "",
  });

  // Configure push dialog
  const [pushDialogDevice, setPushDialogDevice] = useState<HikvisionDevice | null>(null);
  const [isSubmittingPush, setIsSubmittingPush] = useState(false);
  const [pushForm, setPushForm] = useState({
    publicHost: "",
    publicPort: "443",
    useHttps: true,
  });

  // Add employee dialog
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [isSubmittingEmployee, setIsSubmittingEmployee] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    employeeNo: "",
    fullName: "",
    teacherId: "",
  });

  // Upload face dialog
  const [faceDialogEmployee, setFaceDialogEmployee] = useState<HikvisionEmployee | null>(null);
  const [facePhoto, setFacePhoto] = useState<File | null>(null);
  const [isUploadingFace, setIsUploadingFace] = useState(false);

  const [removingEmployeeId, setRemovingEmployeeId] = useState<string | null>(null);

  // Admin-only page: everyone else is bounced to the dashboard, same guard
  // used by /branches. The backend enforces the same restriction on every
  // /hikvision endpoint, so this is a UX shortcut, not the real gate.
  useEffect(() => {
    if (!hasCheckedAuth) {
      if (currentUser?.role !== "admin") {
        router.push("/");
        return;
      }
      setHasCheckedAuth(true);
      loadDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCheckedAuth, currentUser, router]);

  useEffect(() => {
    const handleBranchChange = () => {
      setSelectedDeviceId("");
      setEmployees([]);
      setRecordsLoaded(false);
      loadDevices();
    };
    window.addEventListener("branchChange", handleBranchChange);
    return () => window.removeEventListener("branchChange", handleBranchChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDeviceId) {
      loadEmployees(selectedDeviceId);
    } else {
      setEmployees([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId]);

  useEffect(() => {
    if (activeTab === "records" && !recordsLoaded) {
      loadRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const getBranchId = () =>
    typeof window !== "undefined" ? localStorage.getItem("selectedBranchId") : null;

  const loadDevices = async () => {
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
      setSelectedDeviceId((prev) => prev || (deviceList[0]?.id ?? ""));
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

  const loadEmployees = async (deviceId: string) => {
    try {
      const list = await listHikvisionEmployees(deviceId);
      setEmployees(list);
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("failedToLoadEmployees"),
        variant: "destructive",
      });
    }
  };

  const loadRecords = async () => {
    try {
      setRecordsLoading(true);
      const list = await listHikvisionAttendance({
        deviceId: filterDeviceId !== "all" ? filterDeviceId : undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
      });
      setRecords(list);
      setRecordsLoaded(true);
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("failedToLoadAttendance"),
        variant: "destructive",
      });
    } finally {
      setRecordsLoading(false);
    }
  };

  const resetDeviceForm = () =>
    setDeviceForm({ name: "", host: "", username: "admin", password: "" });

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const branchId = getBranchId();
    if (!branchId) {
      toast({ title: t("error"), description: t("selectBranchFirst"), variant: "destructive" });
      return;
    }
    setIsSubmittingDevice(true);
    try {
      const device = await createHikvisionDevice({
        branchId,
        name: deviceForm.name,
        host: deviceForm.host,
        username: deviceForm.username || undefined,
        password: deviceForm.password,
      });
      toast({ title: t("success"), description: t("deviceAdded"), variant: "success" });
      resetDeviceForm();
      setIsDeviceDialogOpen(false);
      setDevices((prev) => [...prev, device]);
      setSelectedDeviceId(device.id);
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("failedToAddDevice"),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingDevice(false);
    }
  };

  const openPushDialog = (device: HikvisionDevice) => {
    setPushDialogDevice(device);
    setPushForm({ publicHost: "", publicPort: "443", useHttps: true });
  };

  const handleConfigurePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushDialogDevice) return;
    setIsSubmittingPush(true);
    try {
      await configureHikvisionPush(pushDialogDevice.id, {
        publicHost: pushForm.publicHost,
        publicPort: parseInt(pushForm.publicPort, 10) || 443,
        useHttps: pushForm.useHttps,
      });
      toast({ title: t("success"), description: t("pushConfigured"), variant: "success" });
      setPushDialogDevice(null);
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("failedToConfigurePush"),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingPush(false);
    }
  };

  const resetEmployeeForm = () =>
    setEmployeeForm({ employeeNo: "", fullName: "", teacherId: "" });

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId) return;
    setIsSubmittingEmployee(true);
    try {
      await addHikvisionEmployee({
        deviceId: selectedDeviceId,
        employeeNo: employeeForm.employeeNo,
        fullName: employeeForm.fullName,
        teacherId: employeeForm.teacherId || null,
      });
      toast({ title: t("success"), description: t("employeeAdded"), variant: "success" });
      resetEmployeeForm();
      setIsEmployeeDialogOpen(false);
      await loadEmployees(selectedDeviceId);
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("failedToAddEmployee"),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingEmployee(false);
    }
  };

  const handleUploadFace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faceDialogEmployee) return;
    if (!facePhoto) {
      toast({ title: t("error"), description: t("photoRequired"), variant: "destructive" });
      return;
    }
    setIsUploadingFace(true);
    try {
      await uploadHikvisionEmployeeFace(faceDialogEmployee.id, facePhoto);
      toast({ title: t("success"), description: t("faceUploaded"), variant: "success" });
      setFaceDialogEmployee(null);
      setFacePhoto(null);
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("failedToUploadFace"),
        variant: "destructive",
      });
    } finally {
      setIsUploadingFace(false);
    }
  };

  const handleRemoveEmployee = async (employee: HikvisionEmployee) => {
    if (!confirm(t("confirmRemoveEmployee"))) return;
    setRemovingEmployeeId(employee.id);
    try {
      await removeHikvisionEmployee(employee.id);
      toast({ title: t("success"), description: t("employeeRemoved"), variant: "success" });
      await loadEmployees(selectedDeviceId);
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("failedToRemoveEmployee"),
        variant: "destructive",
      });
    } finally {
      setRemovingEmployeeId(null);
    }
  };

  const getTeacherName = (teacherId?: string | null) => {
    if (!teacherId) return null;
    return teachers.find((tc) => tc.id === teacherId)?.fullName || null;
  };

  const getDeviceName = (deviceId: string) =>
    devices.find((d) => d.id === deviceId)?.name || deviceId;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-full sm:w-96" />
        <Card>
          <CardContent className="space-y-4 pt-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4 border-b">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const noBranchSelected = !getBranchId();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Fingerprint className="w-7 h-7 text-indigo-600" />
          {t("attendance")}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">{t("attendanceSubtitle")}</p>
      </div>

      {noBranchSelected ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-500 dark:text-slate-400">
            {t("selectBranchFirst")}
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="devices">{t("tabDevices")}</TabsTrigger>
            <TabsTrigger value="employees">{t("tabEmployees")}</TabsTrigger>
            <TabsTrigger value="records">{t("tabRecords")}</TabsTrigger>
          </TabsList>

          {/* ============================== DEVICES ============================== */}
          <TabsContent value="devices" className="space-y-4 pt-4">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/30 px-4 py-3 text-sm text-indigo-900 dark:text-indigo-300">
              {t("hikvisionCliNote")}
            </div>

            <div className="flex justify-end">
              <Dialog open={isDeviceDialogOpen} onOpenChange={setIsDeviceDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    onClick={resetDeviceForm}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("addDevice")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{t("addNewDevice")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddDevice} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="deviceName">{t("deviceName")} *</Label>
                      <Input
                        id="deviceName"
                        value={deviceForm.name}
                        onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                        placeholder="Wonder Kids terminal"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deviceHost">{t("deviceHost")} *</Label>
                      <Input
                        id="deviceHost"
                        value={deviceForm.host}
                        onChange={(e) => setDeviceForm({ ...deviceForm, host: e.target.value })}
                        placeholder="192.168.0.115"
                        required
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("deviceHostHint")}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="deviceUsername">{t("deviceUsername")}</Label>
                        <Input
                          id="deviceUsername"
                          value={deviceForm.username}
                          onChange={(e) =>
                            setDeviceForm({ ...deviceForm, username: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="devicePassword">{t("password")} *</Label>
                        <Input
                          id="devicePassword"
                          type="password"
                          value={deviceForm.password}
                          onChange={(e) =>
                            setDeviceForm({ ...deviceForm, password: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDeviceDialogOpen(false)}
                        disabled={isSubmittingDevice}
                      >
                        {t("cancel")}
                      </Button>
                      <Button type="submit" disabled={isSubmittingDevice}>
                        {isSubmittingDevice ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        {t("create")}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="pt-6">
                {devices.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    {t("noDevicesYet")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("deviceName")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("deviceHost")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("status")}
                          </th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {devices.map((device) => (
                          <tr
                            key={device.id}
                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                          >
                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                              {device.name}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                              {device.host}
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant="outline"
                                className={
                                  device.isActive
                                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                                }
                              >
                                {device.isActive ? t("active") : t("status")}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button size="sm" variant="outline" onClick={() => openPushDialog(device)}>
                                <Wifi className="w-4 h-4 mr-2" />
                                {t("configurePush")}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog
              open={!!pushDialogDevice}
              onOpenChange={(open) => !open && setPushDialogDevice(null)}
            >
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t("configurePush")}</DialogTitle>
                  <DialogDescription>{t("configurePushDescription")}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleConfigurePush} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="publicHost">{t("publicHost")} *</Label>
                    <Input
                      id="publicHost"
                      value={pushForm.publicHost}
                      onChange={(e) => setPushForm({ ...pushForm, publicHost: e.target.value })}
                      placeholder="incredible-love-production-0008.up.railway.app"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <div className="space-y-2">
                      <Label htmlFor="publicPort">{t("publicPort")}</Label>
                      <Input
                        id="publicPort"
                        type="number"
                        value={pushForm.publicPort}
                        onChange={(e) => setPushForm({ ...pushForm, publicPort: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-2">
                      <Switch
                        id="useHttps"
                        checked={pushForm.useHttps}
                        onCheckedChange={(checked) =>
                          setPushForm({ ...pushForm, useHttps: checked })
                        }
                      />
                      <Label htmlFor="useHttps">{t("useHttps")}</Label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPushDialogDevice(null)}
                      disabled={isSubmittingPush}
                    >
                      {t("cancel")}
                    </Button>
                    <Button type="submit" disabled={isSubmittingPush}>
                      {isSubmittingPush && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {t("configurePush")}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ============================= EMPLOYEES ============================= */}
          <TabsContent value="employees" className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="w-full sm:w-72">
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectDevice")} />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Dialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    onClick={resetEmployeeForm}
                    disabled={!selectedDeviceId}
                    title={!selectedDeviceId ? t("addEmployeeToDevice") : ""}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("addEmployee")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{t("addNewEmployee")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddEmployee} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="employeeFullName">{t("fullName")} *</Label>
                      <Input
                        id="employeeFullName"
                        value={employeeForm.fullName}
                        onChange={(e) =>
                          setEmployeeForm({ ...employeeForm, fullName: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeNo">{t("employeeNo")} *</Label>
                      <Input
                        id="employeeNo"
                        value={employeeForm.employeeNo}
                        onChange={(e) =>
                          setEmployeeForm({ ...employeeForm, employeeNo: e.target.value })
                        }
                        placeholder="1001"
                        required
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("employeeNoHint")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("linkedTeacherOptional")}</Label>
                      <Select
                        value={employeeForm.teacherId || "none"}
                        onValueChange={(value) =>
                          setEmployeeForm({
                            ...employeeForm,
                            teacherId: value === "none" ? "" : value,
                          })
                        }
                      >
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
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEmployeeDialogOpen(false)}
                        disabled={isSubmittingEmployee}
                      >
                        {t("cancel")}
                      </Button>
                      <Button type="submit" disabled={isSubmittingEmployee}>
                        {isSubmittingEmployee && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {t("create")}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="pt-6">
                {!selectedDeviceId ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    {t("addEmployeeToDevice")}
                  </div>
                ) : employees.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    {t("noEmployeesYet")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("fullName")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("employeeNo")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("teacher")}
                          </th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((employee) => (
                          <tr
                            key={employee.id}
                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                          >
                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                              {employee.fullName}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                              {employee.employeeNo}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                              {getTeacherName(employee.teacherId) || "—"}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setFaceDialogEmployee(employee);
                                    setFacePhoto(null);
                                  }}
                                >
                                  <Upload className="w-4 h-4 mr-2" />
                                  {t("uploadFace")}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleRemoveEmployee(employee)}
                                  disabled={removingEmployeeId === employee.id}
                                >
                                  {removingEmployeeId === employee.id ? (
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

            <Dialog
              open={!!faceDialogEmployee}
              onOpenChange={(open) => {
                if (!open) {
                  setFaceDialogEmployee(null);
                  setFacePhoto(null);
                }
              }}
            >
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("uploadFace")}</DialogTitle>
                  <DialogDescription>{t("uploadFaceDescription")}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUploadFace} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="facePhoto">{t("choosePhoto")}</Label>
                    <Input
                      id="facePhoto"
                      type="file"
                      accept="image/jpeg,image/jpg"
                      onChange={(e) => setFacePhoto(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFaceDialogEmployee(null);
                        setFacePhoto(null);
                      }}
                      disabled={isUploadingFace}
                    >
                      {t("cancel")}
                    </Button>
                    <Button type="submit" disabled={isUploadingFace}>
                      {isUploadingFace && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {t("uploadFace")}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ============================== RECORDS =============================== */}
          <TabsContent value="records" className="space-y-4 pt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("filter")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="w-full sm:w-56 space-y-2">
                    <Label>{t("tabDevices")}</Label>
                    <Select value={filterDeviceId} onValueChange={setFilterDeviceId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("allDevices")}</SelectItem>
                        {devices.map((device) => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full sm:w-44 space-y-2">
                    <Label htmlFor="filterFrom">{t("dateFrom")}</Label>
                    <Input
                      id="filterFrom"
                      type="date"
                      value={filterFrom}
                      onChange={(e) => setFilterFrom(e.target.value)}
                    />
                  </div>
                  <div className="w-full sm:w-44 space-y-2">
                    <Label htmlFor="filterTo">{t("dateTo")}</Label>
                    <Input
                      id="filterTo"
                      type="date"
                      value={filterTo}
                      onChange={(e) => setFilterTo(e.target.value)}
                    />
                  </div>
                  <Button onClick={loadRecords} disabled={recordsLoading}>
                    {recordsLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    {t("search")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {recordsLoading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : records.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    {t("noAttendanceYet")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("employeeColumn")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("tabDevices")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("eventTime")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t("status")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr
                            key={record.id}
                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                          >
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {record.employeeName || record.employeeNo}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {record.employeeNo}
                              </p>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                              {getDeviceName(record.deviceId)}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                              {formatDateTimeInTashkent(record.eventTime)}
                            </td>
                            <td className="py-3 px-4">
                              {record.eventType === "check_in" ? (
                                <Badge
                                  variant="outline"
                                  className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                >
                                  <LogIn className="w-3 h-3 mr-1" />
                                  {t("checkIn")}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  <LogOutIcon className="w-3 h-3 mr-1" />
                                  {t("checkOut")}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
