import { useState } from "react";
import { AlertTriangle, Bell, CreditCard, Info, Loader2, Save, Server, Shield } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { StatusPill, type Tone } from "@/components/kit/StatusPill";
import { EmptyState, ErrorNotice } from "@/components/kit/States";
import { SwitchRow } from "@/components/kit/Field";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import { formatDateTime } from "@/lib/format";
import {
  getNotificationPreferences, getRecentNotifications, updateNotificationPreferences,
} from "@/services/api-client";

interface Prefs { errors: boolean; deployments: boolean; security: boolean; weeklyReport: boolean }

const DEFAULTS: Prefs = { errors: true, deployments: true, security: true, weeklyReport: false };

const TOGGLES: { key: keyof Prefs; labelKey: string; descKey: string; icon: React.ElementType }[] = [
  { key: "errors", labelKey: "errorAlerts", descKey: "errorAlertsDesc", icon: AlertTriangle },
  { key: "deployments", labelKey: "deploymentAlerts", descKey: "deploymentAlertsDesc", icon: Server },
  { key: "security", labelKey: "securityAlerts", descKey: "securityAlertsDesc", icon: Shield },
  { key: "weeklyReport", labelKey: "weeklyReport", descKey: "weeklyReportDesc", icon: CreditCard },
];

const levelTone = (level: string): Tone => (["error", "critical"].includes(level.toLowerCase()) ? "critical" : "warning");

export default function Notifications() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  // An empty object from the server means "never saved" → defaults. A *failed* load is
  // different: saving then would overwrite real preferences with defaults, so it's blocked.
  const prefsRes = useResource<Prefs>(async () => {
    const raw = await getNotificationPreferences();
    return raw && typeof raw === "object" ? { ...DEFAULTS, ...(raw as Partial<Prefs>) } : DEFAULTS;
  }, t("failedToSavePreferences"));
  const recentRes = useResource(getRecentNotifications, t("failedToLoadData"));

  const [draft, setDraft] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  const prefs = draft ?? prefsRes.data ?? DEFAULTS;
  const dirty = draft !== null;
  const loadFailed = !!prefsRes.error && !prefsRes.data;

  const toggle = (key: keyof Prefs) => setDraft({ ...prefs, [key]: !prefs[key] });

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      // The endpoint replaces the stored preferences wholesale, so send the full object.
      await updateNotificationPreferences(draft as unknown as Record<string, unknown>);
      prefsRes.setData(draft);
      setDraft(null);
      toast.success(t("notificationPreferencesSaved"));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("failedToSavePreferences"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={t("notificationsTitle")}
        description={t("configureAlertPreferences")}
        actions={
          <Button className="gap-2" onClick={() => void save()} disabled={saving || !dirty || loadFailed}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? t("saving") : t("savePreferences")}
          </Button>
        }
      />

      {loadFailed && <ErrorNotice message={t("prefsLoadFailed")} onRetry={() => void prefsRes.reload()} />}

      <div className="max-w-2xl space-y-6">
        <div className="flex items-start gap-3 rounded-lg border border-status-info/25 bg-status-info/10 p-4 text-status-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm">{t("displayPreferencesNotice")}</p>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{t("alertTypes")}</h2>
          <div className="divide-y rounded-xl border bg-card">
            {prefsRes.loading
              ? [0, 1, 2, 3].map((i) => <div key={i} className="p-4"><Skeleton className="h-10 w-full" /></div>)
              : TOGGLES.map(({ key, labelKey, descKey, icon: Icon }) => (
                  <div key={key} className="flex items-center gap-3 p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <SwitchRow label={t(labelKey)} description={t(descKey)}>
                        <Switch checked={prefs[key]} disabled={loadFailed} onCheckedChange={() => toggle(key)} aria-label={t(labelKey)} />
                      </SwitchRow>
                    </div>
                  </div>
                ))}
          </div>
          {dirty && <p className="mt-2 text-xs text-muted-foreground">{t("unsavedChangesNotice")}</p>}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{t("recentActivity")}</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            {recentRes.loading ? (
              <div className="space-y-3 p-4"><Skeleton className="h-9" /><Skeleton className="h-9" /></div>
            ) : recentRes.error ? (
              <div className="p-4"><ErrorNotice className="mb-0" message={recentRes.error} onRetry={() => void recentRes.reload()} /></div>
            ) : (recentRes.data ?? []).length === 0 ? (
              <EmptyState icon={Bell} title={t("noRecentAlerts")} className="py-10" />
            ) : (
              <ul className="divide-y">
                {(recentRes.data ?? []).map((n) => (
                  <li key={n.id} className="flex items-start gap-3 p-3.5">
                    <StatusPill tone={levelTone(n.level)} dot={false} className="mt-0.5 shrink-0">{n.level}</StatusPill>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.module ? `${n.module} · ` : ""}
                        {formatDateTime(n.createdAt, language)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
