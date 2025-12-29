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
import { Settings, Language } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { Save, Globe, DollarSign, Building2 } from "lucide-react";
import { hasPermission } from "@/lib/auth";
import { useRouter } from "next/router";
import { useSetLanguage } from "@/hooks/use-language";
import { formatNumberWithSpaces, removeNumberFormatting } from "@/lib/utils";
import { getSettings, updateSettings, UpdateSettingsRequest } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { formatDateTimeInTashkent } from "@/lib/timezone";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<Settings | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const language = useLanguage();
  const setLanguage = useSetLanguage();
  const t = (key: string) => getTranslation(key, language);
  const router = useRouter();
  const { currentBranch } = useBranch();

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getSettings();
      setSettings(data);
      setOriginalSettings(data);
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
                  {new Date(settings.createdDate).toLocaleString("sv-SE", {
                    timeZone: "Asia/Tashkent",
                  })}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  {t("lastUpdated")}
                </Label>
                <p className="text-sm font-medium">
                  {new Date(settings.updatedDate).toLocaleString("sv-SE", {
                    timeZone: "Asia/Tashkent",
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
