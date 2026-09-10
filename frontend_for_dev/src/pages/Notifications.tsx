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
  label: string;
  desc: string;
  icon: React.ElementType;
  iconCls: string;
}[] = [
  {
    key: "errors",
    label: "Error Alerts",
    desc: "Get notified when the error rate spikes or critical errors are logged",
    icon: AlertTriangle,
    iconCls: "text-status-critical bg-status-critical/15",
  },
  {
    key: "deployments",
    label: "Deployment Alerts",
    desc: "Notify when a new deployment is detected on the backend",
    icon: Server,
    iconCls: "text-status-info bg-status-info/15",
  },
  {
    key: "security",
    label: "Security Alerts",
    desc: "Unusual login attempts, failed auth, or suspicious access patterns",
    icon: Shield,
    iconCls: "text-status-warning bg-status-warning/15",
  },
  {
    key: "weeklyReport",
    label: "Weekly Report",
    desc: "Summary digest of metrics, errors, and activity every Monday",
    icon: CreditCard,
    iconCls: "text-primary bg-primary/15",
  },
];

export default function Notifications() {
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
      toast.success("Notification preferences saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure alert preferences for the developer portal</p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={save}
          disabled={saving || !dirty}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save Preferences"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-status-info/25 bg-status-info/10 text-status-info">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              These toggles are display preferences for this portal only — there is no email/push
              delivery configured server-side yet.
            </p>
          </div>

          {/* Recent Activity */}
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
            </div>
            <div className="divide-y divide-border">
              {recentLoading ? (
                <div className="p-6 flex justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : recent.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No recent alerts.</p>
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
              <h2 className="text-sm font-semibold text-foreground">Alert Types</h2>
            </div>
            <div className="divide-y divide-border">
              {TOGGLES.map(({ key, label, desc, icon: Icon, iconCls }) => (
                <div key={key} className="flex items-center justify-between p-4 gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", iconCls)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
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
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Current Configuration</h3>
            <div className="grid grid-cols-2 gap-3">
              {TOGGLES.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    prefs[key] ? "bg-status-healthy" : "bg-muted-foreground/40"
                  )} />
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn(
                    "ml-auto text-xs font-semibold",
                    prefs[key] ? "text-status-healthy" : "text-muted-foreground"
                  )}>
                    {prefs[key] ? "ON" : "OFF"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {dirty && (
            <p className="text-xs text-center text-muted-foreground">
              You have unsaved changes — click Save Preferences to persist them.
            </p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
