import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Bell, AlertTriangle, Shield, CreditCard, Server,
  Save, Loader2, Info, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getNotificationPreferences, updateNotificationPreferences,
  getRecentNotifications, type RecentNotification,
} from "@/services/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/i18n";

interface NotifPrefs {
  errors: boolean;
  deployments: boolean;
  security: boolean;
  weeklyReport: boolean;
}

const DEFAULTS: NotifPrefs = {
  errors: true,
  deployments: true,
  security: true,
  weeklyReport: false,
};

const TOGGLES: {
  key: keyof NotifPrefs;
  labelKey: string;
  descKey: string;
  icon: React.ElementType;
  iconCls: string;
}[] = [
  {
    key: "errors",
    labelKey: "errorAlerts",
    descKey: "errorAlertsDesc",
    icon: AlertTriangle,
    iconCls: "text-status-critical bg-status-critical/15",
  },
  {
    key: "deployments",
    labelKey: "deploymentAlerts",
    descKey: "deploymentAlertsDesc",
    icon: Server,
    iconCls: "text-status-info bg-status-info/15",
  },
  {
    key: "security",
    labelKey: "securityAlerts",
    descKey: "securityAlertsDesc",
    icon: Shield,
    iconCls: "text-status-warning bg-status-warning/15",
  },
  {
    key: "weeklyReport",
    labelKey: "weeklyReport",
    descKey: "weeklyReportDesc",
    icon: CreditCard,
    iconCls: "text-primary bg-primary/15",
  },
];

export default function Notifications() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [recent, setRecent] = useState<RecentNotification[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await getNotificationPreferences();
      if (raw && typeof raw === "object" && Object.keys(raw).length > 0) {
        setPrefs({ ...DEFAULTS, ...(raw as Partial<NotifPrefs>) });
      }
    } catch {
      // Graceful fallback — notifications are optional
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      setRecent(await getRecentNotifications());
    } catch {
      setRecent([]);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadRecent(); }, [load, loadRecent]);

  const toggle = (key: keyof NotifPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      // This endpoint replaces the stored preferences wholesale (not a
      // merge), so the full prefs object is sent every time.
      await updateNotificationPreferences(prefs as unknown as Record<string, unknown>);
      setDirty(false);
      toast.success(t("notificationPreferencesSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToSavePreferences"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("notificationsTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("configureAlertPreferences")}</p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={save}
          disabled={saving || !dirty}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t("saving") : t("savePreferences")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("loading")}
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-status-info/25 bg-status-info/10 text-status-info">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              {t("displayPreferencesNotice")}
            </p>
          </div>

          {/* Recent Activity */}
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">{t("recentActivity")}</h2>
            </div>
            <div className="divide-y divide-border">
              {recentLoading ? (
                <div className="p-6 flex justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : recent.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">{t("noRecentAlerts")}</p>
              ) : (
                recent.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 p-3">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5",
                      n.level.toLowerCase() === "error" || n.level.toLowerCase() === "critical"
                        ? "bg-status-critical/15 text-status-critical"
                        : "bg-status-warning/15 text-status-warning"
                    )}>
                      {n.level}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{n.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.module ? `${n.module} · ` : ""}{new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Alert Type Toggles */}
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">{t("alertTypes")}</h2>
            </div>
            <div className="divide-y divide-border">
              {TOGGLES.map(({ key, labelKey, descKey, icon: Icon, iconCls }) => (
                <div key={key} className="flex items-center justify-between p-4 gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", iconCls)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t(labelKey)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t(descKey)}</p>
                    </div>
                  </div>
                  <Switch
                    checked={prefs[key]}
                    onCheckedChange={() => toggle(key)}
                    className="flex-shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Current State Summary */}
          <div className="glass-card rounded-lg p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("currentConfiguration")}</h3>
            <div className="grid grid-cols-2 gap-3">
              {TOGGLES.map(({ key, labelKey }) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    prefs[key] ? "bg-status-healthy" : "bg-muted-foreground/40"
                  )} />
                  <span className="text-muted-foreground">{t(labelKey)}</span>
                  <span className={cn(
                    "ml-auto text-xs font-semibold",
                    prefs[key] ? "text-status-healthy" : "text-muted-foreground"
                  )}>
                    {prefs[key] ? t("on") : t("off")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {dirty && (
            <p className="text-xs text-center text-muted-foreground">
              {t("unsavedChangesNotice")}
            </p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
