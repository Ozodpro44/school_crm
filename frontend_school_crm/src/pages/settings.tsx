import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Language, Branch } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { Save, Globe, DollarSign, Building2, Calendar, ChevronRight, Loader2 } from "lucide-react";
import { hasPermission, getCurrentUser } from "@/lib/auth";
import { useRouter } from "next/router";
import { useSetLanguage } from "@/hooks/use-language";
import { formatNumberWithSpaces, removeNumberFormatting } from "@/lib/utils";
import { getSettings, updateSettings, UpdateSettingsRequest, switchBranchMonth, getBranch } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { formatDateTimeInTashkent } from "@/lib/timezone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<Settings | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const [showSwitchMonthDialog, setShowSwitchMonthDialog] = useState(false);
  const [isSwitchingMonth, setIsSwitchingMonth] = useState(false);
  const { toast } = useToast();
  const language = useLanguage();
  const setLanguage = useSetLanguage();
  const t = (key: string) => getTranslation(key, language);
  const router = useRouter();
  const { currentBranch, refreshBranches } = useBranch();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getSettings();
      setSettings(data);
      setOriginalSettings(data);
      
      // Also fetch branch data for current month info
      const branchId = localStorage.getItem("selectedBranchId");
      if (branchId) {
        const branch = await getBranch(branchId);
        setBranchData(branch);
      }
    } catch (error) {
      toast({
        title: t("error"),
        description: t("failedToLoadSettings"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number | string) => {
    const monthNum = typeof month === "string" ? parseInt(month) : month;
    const monthNames: { [key: number]: string } = {
      1: t("january") || "Январь",
      2: t("february") || "Февраль",
      3: t("march") || "Март",
      4: t("april") || "Апрель",
      5: t("may") || "Май",
      6: t("june") || "Июнь",
      7: t("july") || "Июль",
      8: t("august") || "Август",
      9: t("september") || "Сентябрь",
      10: t("october") || "Октябрь",
      11: t("november") || "Ноябрь",
      12: t("december") || "Декабрь",
    };
    return monthNames[monthNum] || month;
  };

  const getNextMonth = () => {
    if (!branchData?.currentFinancialMonth) return { month: 1, year: 0 };
    const currentMonth = branchData.currentFinancialMonth.month;
    const currentYear = branchData.currentFinancialMonth.year;
    
    if (currentMonth >= 12) {
      return { month: 1, year: currentYear + 1 };
    }
    return { month: currentMonth + 1, year: currentYear };
  };

  const handleSwitchMonth = async () => {
    const branchId = localStorage.getItem("selectedBranchId");
    if (!branchId) return;

    try {
      setIsSwitchingMonth(true);
      const updatedBranch = await switchBranchMonth(branchId);
      setBranchData(updatedBranch);
      setShowSwitchMonthDialog(false);
      
      // Refresh branch context
      if (refreshBranches) {
        await refreshBranches();
      }
      
      // Dispatch branchChange event to reload all pages with new month data
      // This will cause payments, expenses, salaries pages to reload with new (empty) data
      window.dispatchEvent(new CustomEvent("branchChange", { detail: branchId }));
      
      toast({
        title: t("success"),
        description: t("monthSwitched") || `Месяц переключён на ${updatedBranch.currentFinancialMonth ? getMonthName(updatedBranch.currentFinancialMonth.month) : "неизвестный"} ${updatedBranch.currentFinancialMonth?.year || ""}`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("failedToSwitchMonth") || "Не удалось переключить месяц",
        variant: "destructive",
      });
    } finally {
      setIsSwitchingMonth(false);
    }
  };

  useEffect(() => {
    if (!hasPermission("canViewSettings")) {
      router.push("/");
      return;
    }

    fetchSettings();
  }, [router]);

  // Reload settings when branch changes
  useEffect(() => {
    if (currentBranch) {
      fetchSettings();
    }
  }, [currentBranch?.id]);

  const handleSave = async () => {
    if (!settings) return;

    if (!hasPermission("canEditSettings")) {
      toast({
        title: t("error"),
        description: t("noPermissionEditSettings"),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);

      // Prepare update payload
      const updatePayload: UpdateSettingsRequest = {
        monthlyPayment: settings.monthlyPayment,
        currency: settings.currency,
        name: settings.name,
      };

      const updatedSettings = await updateSettings(updatePayload);

      // Update original settings so changes are no longer detected
      setOriginalSettings(updatedSettings);
      setSettings(updatedSettings);

      toast({
        title: t("success"),
        description: t("settingsSaved"),
        variant: "success",
      });
    } catch (error) {
      toast({
        title: t("error"),
        description:
          error instanceof Error ? error.message : t("failedToSaveSettings"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof Settings, value: string | number) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleLanguageChange = (value: Language) => {
    setLanguage(value);
  };

  const hasChanges = () => {
    if (!settings || !originalSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("settings")}</h1>
          <p className="text-muted-foreground">{t("manageSystemSettings")}</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={
            !hasPermission("canEditSettings") || !hasChanges() || isSaving
          }
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? t("saving") : t("save")}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t("generalSettings")}
            </CardTitle>
            <CardDescription>{t("branchName")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("branchName")}</Label>
              <Input
                id="name"
                value={settings.name}
                onChange={(e) => handleChange("name", e.target.value)}
                disabled={!hasPermission("canEditSettings")}
                placeholder={t("enterBranchName")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Financial Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {t("financialSettings")}
            </CardTitle>
            <CardDescription>{t("branchPaymentSettings")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="monthlyPayment">
                {t("monthlyPayment")}
              </Label>
              <Input
                id="monthlyPayment"
                type="text"
                value={formatNumberWithSpaces(
                  settings.monthlyPayment.toString()
                )}
                onChange={(e) =>
                  handleChange(
                    "monthlyPayment",
                    parseInt(removeNumberFormatting(e.target.value)) || 0
                  )
                }
                disabled={!hasPermission("canEditSettings")}
                placeholder="500 000"
                step="500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">{t("currency")}</Label>
              <Select
                value={settings.currency}
                onValueChange={(value) => handleChange("currency", value)}
                disabled={!hasPermission("canEditSettings")}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">UZS - Ўзбек сўм</SelectItem>
                  <SelectItem value="USD">USD - Доллар</SelectItem>
                  <SelectItem value="EUR">EUR - Евро</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Current Month - Admin Only */}
        {isAdmin && branchData && (
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t("currentMonth") || "Текущий месяц"}
              </CardTitle>
              <CardDescription>
                {t("currentMonthDescription") || "Все платежи, расходы и зарплаты записываются в этот месяц"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  {branchData?.currentFinancialMonth ? (
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {getMonthName(branchData.currentFinancialMonth.month)} {branchData.currentFinancialMonth.year}
                    </p>
                  ) : (
                    <p className="text-3xl font-bold text-gray-400 dark:text-gray-600">
                      {t("loading") || "Загрузка..."}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("activeMonth") || "Активный период для записи данных"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowSwitchMonthDialog(true)}
                  className="flex items-center gap-2"
                  disabled={!branchData?.currentFinancialMonth}
                >
                  {t("switchToNextMonth") || "Следующий месяц"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Information */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t("systemInformation")}</CardTitle>
            <CardDescription>{t("branchInformationTimestamps")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  {t("created")}
                </Label>
                <p className="text-sm font-medium">
                  {new Date(settings.createdDate).toLocaleString("ru-RU", {
                    timeZone: "Asia/Tashkent",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).replace(",", "")}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  {t("lastUpdated")}
                </Label>
                <p className="text-sm font-medium">
                  {new Date(settings.updatedDate).toLocaleString("ru-RU", {
                    timeZone: "Asia/Tashkent",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).replace(",", "")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Switch Month Confirmation Dialog */}
      <Dialog open={showSwitchMonthDialog} onOpenChange={setShowSwitchMonthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmSwitchMonth") || "Подтвердите переключение месяца"}</DialogTitle>
            <DialogDescription>
              {t("switchMonthWarning") || "После переключения менеджеры не смогут видеть и редактировать данные предыдущего месяца."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("currentMonth") || "Текущий месяц"}</p>
                  <p className="font-semibold">{branchData?.currentFinancialMonth && `${getMonthName(branchData.currentFinancialMonth.month)} ${branchData.currentFinancialMonth.year}`}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("nextMonth") || "Следующий месяц"}</p>
                  <p className="font-semibold text-blue-600">
                    {getMonthName(getNextMonth().month)} {getNextMonth().year}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                {t("switchMonthNote") || "• Новый месяц начнётся с нуля (payments = 0, expenses = 0, salaries = 0)"}
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-100 mt-1">
                {t("switchMonthNoteManager") || "• Менеджеры потеряют доступ к данным прошлого месяца"}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowSwitchMonthDialog(false)}
                disabled={isSwitchingMonth}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleSwitchMonth}
                disabled={isSwitchingMonth}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSwitchingMonth ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("switching") || "Переключение..."}
                  </>
                ) : (
                  t("confirmSwitch") || "Подтвердить"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
