import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Bell, Mail, MessageSquare, AlertTriangle, Server,
  CreditCard, Settings, CheckCircle2, Clock, ExternalLink,
  Save, Loader2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiClient } from "@/services/api-client";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Channel = "email" | "telegram" | "slack";

interface EventPref {
  email: boolean;
  telegram: boolean;
  slack: boolean;
}

type PrefsMap = Record<string, EventPref>;

interface Channels {
  email:    { enabled: boolean; address: string };
  telegram: { enabled: boolean; botToken: string; chatId: string };
  slack:    { enabled: boolean; webhookUrl: string };
}

interface AlertEntry {
  id: string;
  level: string;
  module: string;
  message: string;
  createdAt: string;
}

// ─── Default state ─────────────────────────────────────────────────────────────

const EVENT_DEFS: { id: string; title: string; description: string; category: "system" | "billing" | "security"; icon: React.ElementType }[] = [
  { id: "server_down",        title: "Server Down Alert",         description: "Get notified when any server or service goes offline",  category: "system",   icon: Server       },
  { id: "critical_error",     title: "Critical Errors",           description: "Immediate alerts for critical application errors",       category: "system",   icon: AlertTriangle },
  { id: "high_latency",       title: "High Latency Warning",      description: "Alert when API response time exceeds threshold",         category: "system",   icon: Clock        },
  { id: "subscription_expiry",title: "Subscription Expiry",       description: "Notify before branch subscriptions expire",              category: "billing",  icon: CreditCard   },
  { id: "payment_failed",     title: "Payment Failures",          description: "Alert on failed payment transactions",                   category: "billing",  icon: CreditCard   },
  { id: "failed_login",       title: "Failed Login Attempts",     description: "Multiple failed login attempts from same IP",            category: "security", icon: AlertTriangle },
];

const DEFAULT_PREFS: PrefsMap = Object.fromEntries(
  EVENT_DEFS.map((e) => [e.id, { email: true, telegram: false, slack: false }])
);

const DEFAULT_CHANNELS: Channels = {
  email:    { enabled: true,  address: "" },
  telegram: { enabled: false, botToken: "", chatId: "" },
  slack:    { enabled: false, webhookUrl: "" },
};

function mergePrefs(raw: Record<string, unknown>): PrefsMap {
  const result: PrefsMap = { ...DEFAULT_PREFS };
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const pref = v as Record<string, unknown>;
      result[k] = {
        email:    typeof pref.email    === "boolean" ? pref.email    : DEFAULT_PREFS[k]?.email    ?? false,
        telegram: typeof pref.telegram === "boolean" ? pref.telegram : DEFAULT_PREFS[k]?.telegram ?? false,
        slack:    typeof pref.slack    === "boolean" ? pref.slack    : DEFAULT_PREFS[k]?.slack    ?? false,
      };
    }
  }
  return result;
}

function mergeChannels(raw: Record<string, unknown>): Channels {
  const email    = (raw.email    as Partial<Channels["email"]>)    ?? {};
  const telegram = (raw.telegram as Partial<Channels["telegram"]>) ?? {};
  const slack    = (raw.slack    as Partial<Channels["slack"]>)    ?? {};
  return {
    email:    { ...DEFAULT_CHANNELS.email,    ...email    },
    telegram: { ...DEFAULT_CHANNELS.telegram, ...telegram },
    slack:    { ...DEFAULT_CHANNELS.slack,    ...slack    },
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Notifications() {
  const [prefs, setPrefs] = useState<PrefsMap>(DEFAULT_PREFS);
  const [channels, setChannels] = useState<Channels>(DEFAULT_CHANNELS);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);
  const [channelDirty, setChannelDirty] = useState(false);
  const [savingChannels, setSavingChannels] = useState(false);

  // ── Load from backend ──────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rawPrefs, rawChannels, rawAlerts] = await Promise.all([
        apiClient.getNotificationPreferences().catch(() => ({})),
        apiClient.getNotificationChannels().catch(() => ({})),
        apiClient.getRecentAlerts().catch(() => []),
      ]);
      setPrefs(mergePrefs(rawPrefs));
      setChannels(mergeChannels(rawChannels));
      setAlerts(
        (rawAlerts as AlertEntry[]).slice(0, 20)
      );
      setDirty(false);
      setChannelDirty(false);
    } catch {
      toast.error("Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Toggle a preference cell ───────────────────────────────────────────────

  const togglePref = (id: string, channel: Channel) => {
    setPrefs((prev) => ({
      ...prev,
      [id]: { ...prev[id], [channel]: !prev[id]?.[channel] },
    }));
    setDirty(true);
  };

  // ── Save preferences ───────────────────────────────────────────────────────

  const savePrefs = async () => {
    setSaving(true);
    try {
      await apiClient.updateNotificationPreferences(prefs as Record<string, unknown>);
      setDirty(false);
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  // ── Save channels ──────────────────────────────────────────────────────────

  const saveChannels = async () => {
    setSavingChannels(true);
    try {
      await apiClient.updateNotificationChannels(channels as unknown as Record<string, unknown>);
      setChannelDirty(false);
      setIsIntegrationsOpen(false);
      toast.success("Integration settings saved");
    } catch {
      toast.error("Failed to save integration settings");
    } finally {
      setSavingChannels(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const systemEvents   = EVENT_DEFS.filter((e) => e.category === "system");
  const billingEvents  = EVENT_DEFS.filter((e) => e.category === "billing");
  const securityEvents = EVENT_DEFS.filter((e) => e.category === "security");

  const alertIcon = (level: string) => {
    if (level === "error" || level === "critical") return { icon: AlertTriangle, color: "text-status-critical", bg: "bg-status-critical/15" };
    if (level === "warn" || level === "warning")   return { icon: AlertTriangle, color: "text-status-warning",  bg: "bg-status-warning/15"  };
    return { icon: CheckCircle2, color: "text-status-healthy", bg: "bg-status-healthy/15" };
  };

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 2)   return "just now";
    if (m < 60)  return `${m} minutes ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h} hour${h !== 1 ? "s" : ""} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d !== 1 ? "s" : ""} ago`;
  };

  const EventSection = ({
    title, events, icon: SectionIcon, color,
  }: {
    title: string;
    events: typeof EVENT_DEFS;
    icon: React.ElementType;
    color: string;
  }) => (
    <div className="glass-card rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <SectionIcon className={`w-4 h-4 ${color}`} />
          {title}
        </h3>
      </div>
      <div className="divide-y divide-border">
        {events.map((ev) => {
          const p = prefs[ev.id] ?? { email: false, telegram: false, slack: false };
          return (
            <div key={ev.id} className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg ${color.replace("text-", "bg-")}/15 flex items-center justify-center mt-0.5`}>
                  <ev.icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="font-medium text-foreground">{ev.title}</p>
                  <p className="text-sm text-muted-foreground">{ev.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 ml-11">
                {(["email", "telegram", "slack"] as Channel[]).map((ch) => (
                  <div key={ch} className="flex items-center gap-2">
                    <Switch
                      checked={p[ch]}
                      onCheckedChange={() => togglePref(ev.id, ch)}
                    />
                    {ch === "email"    && <Mail className="w-4 h-4 text-muted-foreground" />}
                    {ch === "telegram" && <MessageSquare className="w-4 h-4 text-muted-foreground" />}
                    {ch === "slack"    && <span className="text-muted-foreground text-sm">Slack</span>}
                    {ch !== "slack"    && <span className="text-sm text-muted-foreground capitalize">{ch}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications & Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how you receive system alerts — settings are persisted to your developer account
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={isIntegrationsOpen} onOpenChange={setIsIntegrationsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Settings className="w-4 h-4" />
                Configure Integrations
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Configure Integrations</DialogTitle>
                <DialogDescription>
                  Set up your notification channels. Credentials are stored in your developer settings.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">

                {/* Email */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      <Label className="font-medium">Email Notifications</Label>
                    </div>
                    <Switch
                      checked={channels.email.enabled}
                      onCheckedChange={(v) => { setChannels((c) => ({ ...c, email: { ...c.email, enabled: v } })); setChannelDirty(true); }}
                    />
                  </div>
                  {channels.email.enabled && (
                    <div className="ml-6">
                      <Label htmlFor="email-address" className="text-sm text-muted-foreground">Email Address</Label>
                      <Input
                        id="email-address"
                        type="email"
                        value={channels.email.address}
                        onChange={(e) => { setChannels((c) => ({ ...c, email: { ...c.email, address: e.target.value } })); setChannelDirty(true); }}
                        className="mt-1"
                        placeholder="alerts@yourschool.com"
                      />
                    </div>
                  )}
                </div>

                {/* Telegram */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#0088cc]" />
                      <Label className="font-medium">Telegram</Label>
                    </div>
                    <Switch
                      checked={channels.telegram.enabled}
                      onCheckedChange={(v) => { setChannels((c) => ({ ...c, telegram: { ...c.telegram, enabled: v } })); setChannelDirty(true); }}
                    />
                  </div>
                  {channels.telegram.enabled && (
                    <div className="ml-6 space-y-3">
                      <div>
                        <Label htmlFor="tg-token" className="text-sm text-muted-foreground">Bot Token</Label>
                        <Input
                          id="tg-token"
                          type="password"
                          placeholder="123456:ABC-DEF1234ghIkl..."
                          value={channels.telegram.botToken}
                          onChange={(e) => { setChannels((c) => ({ ...c, telegram: { ...c.telegram, botToken: e.target.value } })); setChannelDirty(true); }}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tg-chat" className="text-sm text-muted-foreground">Chat ID</Label>
                        <Input
                          id="tg-chat"
                          placeholder="-1001234567890"
                          value={channels.telegram.chatId}
                          onChange={(e) => { setChannels((c) => ({ ...c, telegram: { ...c.telegram, chatId: e.target.value } })); setChannelDirty(true); }}
                          className="mt-1"
                        />
                      </div>
                      <a href="https://core.telegram.org/bots#how-do-i-create-a-bot" target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-1 hover:underline">
                        How to create a Telegram bot <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Slack */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#E01E5A">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                      </svg>
                      <Label className="font-medium">Slack</Label>
                    </div>
                    <Switch
                      checked={channels.slack.enabled}
                      onCheckedChange={(v) => { setChannels((c) => ({ ...c, slack: { ...c.slack, enabled: v } })); setChannelDirty(true); }}
                    />
                  </div>
                  {channels.slack.enabled && (
                    <div className="ml-6 space-y-3">
                      <div>
                        <Label htmlFor="slack-webhook" className="text-sm text-muted-foreground">Webhook URL</Label>
                        <Input
                          id="slack-webhook"
                          type="password"
                          placeholder="https://hooks.slack.com/services/..."
                          value={channels.slack.webhookUrl}
                          onChange={(e) => { setChannels((c) => ({ ...c, slack: { ...c.slack, webhookUrl: e.target.value } })); setChannelDirty(true); }}
                          className="mt-1"
                        />
                      </div>
                      <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-1 hover:underline">
                        How to create a Slack webhook <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsIntegrationsOpen(false)}>Cancel</Button>
                <Button onClick={saveChannels} disabled={savingChannels || !channelDirty}>
                  {savingChannels ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {dirty && (
            <Button onClick={savePrefs} disabled={saving} size="sm">
              {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Saving…</> : <><Save className="w-4 h-4 mr-1" />Save Preferences</>}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading preferences…
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Settings columns */}
          <div className="xl:col-span-2 space-y-6">
            <EventSection title="System Alerts"   events={systemEvents}   icon={Server}       color="text-primary"         />
            <EventSection title="Billing Alerts"  events={billingEvents}  icon={CreditCard}   color="text-status-healthy"  />
            <EventSection title="Security Alerts" events={securityEvents} icon={AlertTriangle} color="text-status-warning" />
          </div>

          {/* Recent Alerts */}
          <div className="glass-card rounded-lg h-fit">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4" /> Recent Alerts
              </h3>
              <span className="text-xs text-muted-foreground">Live from logs</span>
            </div>
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No recent alerts
              </div>
            ) : (
              <div className="divide-y divide-border">
                {alerts.map((a) => {
                  const { icon: Icon, color, bg } = alertIcon(a.level);
                  return (
                    <div key={a.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{a.message}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            {relativeTime(a.createdAt)}
                          </div>
                          {a.module && (
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{a.module}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
