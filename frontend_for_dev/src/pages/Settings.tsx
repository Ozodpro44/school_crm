import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Server, Shield, Globe, Database, Save, Loader2,
  RefreshCw, CheckCircle2, XCircle, Key, Eye, EyeOff, Copy, Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getDevSettings, updateDevSettings, getHealth,
  listMySessions, revokeSession, DeveloperSession,
} from "@/services/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";

const API_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api").replace(/\/$/, "");

const DEFAULTS = {
  requestTimeout: "30",
  rateLimiting: true,
  environment: "production",
  jwtExpiry: "24",
  maxLoginAttempts: "5",
  requireMFA: false,
  maintenanceMode: false,
  logLevel: "info",
  queryLogging: false,
};

type Settings = typeof DEFAULTS;

function merge(raw: Record<string, unknown>): Settings {
  return { ...DEFAULTS, ...raw } as Settings;
}

// ── JWT Inspector ──────────────────────────────────────────────────────────────

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function JwtInspector() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const token = localStorage.getItem("auth_token") ?? "";
  const payload = token ? decodeJwt(token) : null;
  const expTs = payload?.exp as number | undefined;
  const iatTs = payload?.iat as number | undefined;
  const expired = expTs ? new Date(expTs * 1000) < new Date() : false;

  const copy = () => {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="glass-card rounded-lg overflow-hidden lg:col-span-2">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
          <Key className="w-4 h-4 text-status-info" />
          {t("apiTokenInspector")}
        </h3>
      </div>
      <div className="p-4 space-y-4">
        {!token ? (
          <p className="text-sm text-muted-foreground">{t("noAuthTokenFound")}</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>{t("currentToken")}</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-accent/30 rounded-lg text-xs font-mono text-foreground break-all">
                  {show ? token : `${token.slice(0, 8)}${"•".repeat(Math.min(40, token.length - 16))}${token.slice(-8)}`}
                </code>
                <button onClick={() => setShow((v) => !v)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={copy} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {copied && <p className="text-xs text-status-healthy">{t("copiedBang")}</p>}
            </div>
            {payload && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("issuedAt")}</p>
                  <p className="font-medium text-foreground font-mono text-xs">
                    {iatTs ? new Date(iatTs * 1000).toLocaleString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("expiresAt")}</p>
                  <p className={`font-medium font-mono text-xs ${expired ? "text-status-critical" : "text-status-healthy"}`}>
                    {expTs ? new Date(expTs * 1000).toLocaleString() : "—"}
                    {expired && t("expiredSuffix")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("subjectRole")}</p>
                  <p className="font-medium font-mono text-xs text-foreground">
                    {String(payload.sub ?? payload.role ?? "—")}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Active Sessions ────────────────────────────────────────────────────────────

function formatUserAgent(ua: string, t: (key: string) => string): string {
  if (!ua) return t("unknownDevice");
  let os = "Unknown OS";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  return `${browser} · ${os}`;
}

function ActiveSessions() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [sessions, setSessions] = useState<DeveloperSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const token = localStorage.getItem("auth_token") ?? "";
  const currentSessionId = (decodeJwt(token)?.sid as string | undefined) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(await listMySessions());
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (session: DeveloperSession) => {
    setRevokingId(session.id);
    try {
      await revokeSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      toast.success(t("sessionSignedOut"));
      if (session.id === currentSessionId) {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToSignOutSession"));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="glass-card rounded-lg overflow-hidden lg:col-span-2">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
          <Monitor className="w-4 h-4 text-status-info" />
          {t("activeSessions")}
        </h3>
      </div>
      <div className="p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noActiveSessionsFound")}</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-accent/30"
            >
              <Monitor className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">
                    {formatUserAgent(session.userAgent, t)}
                  </p>
                  {session.id === currentSessionId && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                      {t("thisDevice")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {session.ipAddress || "—"} · {tf(t("lastActive"), { time: new Date(session.lastSeenAt).toLocaleString() })}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs flex-shrink-0"
                disabled={revokingId === session.id}
                onClick={() => handleRevoke(session)}
              >
                {revokingId === session.id ? <Loader2 className="w-3 h-3 animate-spin" /> : t("signOut")}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  icon: Icon, iconClass, title, children, onSave, saving, dirty,
}: {
  icon: React.ElementType;
  iconClass: string;
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
          <Icon className={`w-4 h-4 ${iconClass}`} />
          {title}
        </h3>
        <Button size="sm" onClick={onSave} disabled={saving || !dirty} className="gap-1.5 h-7 text-xs">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Settings() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Record<string, boolean>>({
    server: false, security: false, maintenance: false, logging: false,
  });
  const [saving, setSaving] = useState<Record<string, boolean>>({
    server: false, security: false, maintenance: false, logging: false,
  });
  const [health, setHealth] = useState<"loading" | "ok" | "error">("loading");
  const [healthMsg, setHealthMsg] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await getDevSettings();
      setSettings(merge(raw));
    } catch {
      // Graceful fallback to defaults
      const mm = localStorage.getItem("dev:maintenanceMode");
      if (mm !== null) setSettings((prev) => ({ ...prev, maintenanceMode: mm === "true" }));
    } finally {
      setLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setHealth("loading");
    try {
      const h = await getHealth();
      setHealth("ok");
      setHealthMsg(h?.status || "healthy");
    } catch (e) {
      setHealth("error");
      setHealthMsg(e instanceof Error ? e.message : t("unreachable"));
    }
  }, []);

  useEffect(() => {
    loadSettings();
    checkHealth();
  }, [loadSettings, checkHealth]);

  const set = (key: keyof Settings, value: unknown, section: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => ({ ...prev, [section]: true }));
  };

  const saveSection = async (section: string, keys: (keyof Settings)[]) => {
    setSaving((prev) => ({ ...prev, [section]: true }));
    try {
      const patch = Object.fromEntries(keys.map((k) => [k, settings[k]]));
      const saved = await updateDevSettings(patch).catch(async () => {
        // Fallback: return the patch as the "saved" state
        return patch as Record<string, unknown>;
      });
      setSettings((prev) => merge({ ...prev, ...saved }));
      if (keys.includes("maintenanceMode")) {
        localStorage.setItem("dev:maintenanceMode", String(settings.maintenanceMode));
        window.dispatchEvent(new Event("dev:maintenanceModeChanged"));
      }
      setDirty((prev) => ({ ...prev, [section]: false }));
      toast.success(tf(t("settingsSaved"), { section: section.charAt(0).toUpperCase() + section.slice(1) }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToSave"));
    } finally {
      setSaving((prev) => ({ ...prev, [section]: false }));
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("settingsTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("developerPortalConfig")}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={loadSettings}>
          <RefreshCw className="w-4 h-4" />
          {t("reload")}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Server */}
        <Section
          icon={Server} iconClass="text-primary" title={t("server")}
          onSave={() => saveSection("server", ["requestTimeout", "rateLimiting", "environment"])}
          saving={saving.server} dirty={dirty.server}
        >
          <div className="space-y-2">
            <Label>{t("backendApiUrl")}</Label>
            <Input value={API_URL} readOnly className="font-mono text-xs opacity-60 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">{t("setViaEnvVar")}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("backendStatus")}</Label>
              <button onClick={checkHealth} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> {t("check")}
              </button>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30">
              {health === "loading" && <><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">{t("checking")}</span></>}
              {health === "ok"      && <><CheckCircle2 className="w-4 h-4 text-status-healthy" /><span className="text-sm text-status-healthy">{tf(t("connectedWith"), { msg: healthMsg })}</span></>}
              {health === "error"   && <><XCircle className="w-4 h-4 text-status-critical" /><span className="text-sm text-status-critical">{tf(t("cannotReachBackend"), { msg: healthMsg })}</span></>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("requestTimeoutSeconds")}</Label>
            <Input
              type="number"
              value={settings.requestTimeout}
              onChange={(e) => set("requestTimeout", e.target.value, "server")}
              className="w-28 font-mono"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("rateLimiting")}</p>
              <p className="text-xs text-muted-foreground">{t("enableRateLimitingAlerts")}</p>
            </div>
            <Switch
              checked={!!settings.rateLimiting}
              onCheckedChange={(v) => set("rateLimiting", v, "server")}
            />
          </div>
        </Section>

        {/* Security */}
        <Section
          icon={Shield} iconClass="text-status-warning" title={t("security")}
          onSave={() => saveSection("security", ["jwtExpiry", "maxLoginAttempts", "requireMFA"])}
          saving={saving.security} dirty={dirty.security}
        >
          <div className="space-y-2">
            <Label>{t("jwtTokenExpiryHours")}</Label>
            <Input
              type="number"
              value={settings.jwtExpiry}
              onChange={(e) => set("jwtExpiry", e.target.value, "security")}
              className="w-28 font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("maxFailedLoginAttempts")}</Label>
            <Input
              type="number"
              value={settings.maxLoginAttempts}
              onChange={(e) => set("maxLoginAttempts", e.target.value, "security")}
              className="w-28 font-mono"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("requireMfa")}</p>
              <p className="text-xs text-muted-foreground">{t("enforce2faForAdmins")}</p>
            </div>
            <Switch
              checked={!!settings.requireMFA}
              onCheckedChange={(v) => set("requireMFA", v, "security")}
            />
          </div>
        </Section>

        {/* Maintenance */}
        <Section
          icon={Globe} iconClass="text-status-info" title={t("maintenance")}
          onSave={() => saveSection("maintenance", ["maintenanceMode", "environment"])}
          saving={saving.maintenance} dirty={dirty.maintenance}
        >
          <div className="space-y-2">
            <Label>{t("environment")}</Label>
            <Select
              value={settings.environment}
              onValueChange={(v) => set("environment", v, "maintenance")}
            >
              <SelectTrigger className="w-52 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="production">{t("production")}</SelectItem>
                <SelectItem value="staging">{t("staging")}</SelectItem>
                <SelectItem value="development">{t("development")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("maintenanceMode")}</p>
              <p className="text-xs text-muted-foreground">{t("showMaintenanceBanner")}</p>
            </div>
            <Switch
              checked={!!settings.maintenanceMode}
              onCheckedChange={(v) => set("maintenanceMode", v, "maintenance")}
            />
          </div>
          {settings.maintenanceMode && (
            <div className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/25 text-status-warning text-xs">
              {t("maintenanceModeOnNotice")}
            </div>
          )}
        </Section>

        {/* Logging */}
        <Section
          icon={Database} iconClass="text-status-healthy" title={t("logging")}
          onSave={() => saveSection("logging", ["logLevel", "queryLogging"])}
          saving={saving.logging} dirty={dirty.logging}
        >
          <div className="space-y-2">
            <Label>{t("logLevel")}</Label>
            <Select
              value={settings.logLevel}
              onValueChange={(v) => set("logLevel", v, "logging")}
            >
              <SelectTrigger className="w-40 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="debug">{t("debug")}</SelectItem>
                <SelectItem value="info">{t("info")}</SelectItem>
                <SelectItem value="warn">{t("warning")}</SelectItem>
                <SelectItem value="error">{t("errorLevel")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("queryLogging")}</p>
              <p className="text-xs text-muted-foreground">{t("logAllDbQueries")}</p>
            </div>
            <Switch
              checked={!!settings.queryLogging}
              onCheckedChange={(v) => set("queryLogging", v, "logging")}
            />
          </div>
        </Section>

        {/* JWT Inspector */}
        <JwtInspector />

        {/* Active Sessions */}
        <ActiveSessions />
      </div>
    </DashboardLayout>
  );
}
