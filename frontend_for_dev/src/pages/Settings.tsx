import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Eye, EyeOff, Loader2, Monitor, Save } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout, SETTINGS_CHANGED_EVENT } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { StatusPill } from "@/components/kit/StatusPill";
import { ErrorNotice } from "@/components/kit/States";
import { RefreshButton } from "@/components/kit/Toolbar";
import { Field, SwitchRow } from "@/components/kit/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import { copyText } from "@/lib/clipboard";
import { formatDateTime } from "@/lib/format";
import {
  getDevSettings, getHealth, listMySessions, revokeSession, updateDevSettings, type DeveloperSession,
} from "@/services/api-client";

const API_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api").replace(/\/$/, "");

interface FormState {
  requestTimeout: string; rateLimiting: boolean; environment: string;
  jwtExpiry: string; maxLoginAttempts: string; requireMFA: boolean;
  maintenanceMode: boolean; logLevel: string; queryLogging: boolean;
}

const DEFAULTS: FormState = {
  requestTimeout: "30", rateLimiting: true, environment: "production",
  jwtExpiry: "24", maxLoginAttempts: "5", requireMFA: false,
  maintenanceMode: false, logLevel: "info", queryLogging: false,
};

const fromServer = (raw: Record<string, unknown>): FormState => ({
  requestTimeout: String(raw.requestTimeout ?? DEFAULTS.requestTimeout),
  rateLimiting: Boolean(raw.rateLimiting ?? DEFAULTS.rateLimiting),
  environment: String(raw.environment ?? DEFAULTS.environment),
  jwtExpiry: String(raw.jwtExpiry ?? DEFAULTS.jwtExpiry),
  maxLoginAttempts: String(raw.maxLoginAttempts ?? DEFAULTS.maxLoginAttempts),
  requireMFA: Boolean(raw.requireMFA ?? DEFAULTS.requireMFA),
  maintenanceMode: Boolean(raw.maintenanceMode ?? DEFAULTS.maintenanceMode),
  logLevel: String(raw.logLevel ?? DEFAULTS.logLevel),
  queryLogging: Boolean(raw.queryLogging ?? DEFAULTS.queryLogging),
});

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=")));
  } catch {
    return null;
  }
}

export default function Settings() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const res = useResource<FormState>(async () => fromServer(await getDevSettings()), t("settingsLoadFailed"));
  const [draft, setDraft] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const form = draft ?? res.data ?? DEFAULTS;
  const dirty = draft !== null;
  const loadFailed = !!res.error && !res.data;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setDraft({ ...form, [key]: value });

  const save = async () => {
    if (!draft) return;
    const ranges: [keyof FormState, string, number, number][] = [
      ["requestTimeout", t("requestTimeoutSeconds"), 1, 300],
      ["jwtExpiry", t("jwtTokenExpiryHours"), 1, 720],
      ["maxLoginAttempts", t("maxFailedLoginAttempts"), 1, 20],
    ];
    for (const [key, label, min, max] of ranges) {
      const n = Number(draft[key]);
      if (!Number.isInteger(n) || n < min || n > max) {
        toast.error(tf(t("invalidRange"), { field: label, min, max }));
        return;
      }
    }
    setSaving(true);
    try {
      // A failed save must stay a failure — never pretend the platform accepted the change.
      const saved = await updateDevSettings({
        requestTimeout: Number(draft.requestTimeout), rateLimiting: draft.rateLimiting, environment: draft.environment,
        jwtExpiry: Number(draft.jwtExpiry), maxLoginAttempts: Number(draft.maxLoginAttempts), requireMFA: draft.requireMFA,
        maintenanceMode: draft.maintenanceMode, logLevel: draft.logLevel, queryLogging: draft.queryLogging,
      });
      const next = fromServer(saved);
      res.setData(next);
      setDraft(null);
      window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: { maintenanceMode: next.maintenanceMode } }));
      toast.success(t("settingsSavedAll"));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const health = useResource(getHealth, t("cannotReachBackend"));

  return (
    <DashboardLayout>
      <PageHeader
        title={t("settingsTitle")}
        description={t("developerPortalConfig")}
        actions={<RefreshButton onClick={() => { setDraft(null); void res.reload(); }} busy={res.fetching} />}
      />

      {loadFailed && <ErrorNotice message={res.error!} onRetry={() => void res.reload()} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("server")} note={t("platformSettingsNote")} loading={res.loading}>
          <Field label={t("backendApiUrl")} hint={t("setViaEnvVar")}>
            <Input value={API_URL} readOnly className="cursor-default font-mono text-xs text-muted-foreground" />
          </Field>
          <Field label={t("backendStatus")}>
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
              {health.loading ? (
                <span className="text-sm text-muted-foreground">{t("checking")}</span>
              ) : health.error ? (
                <StatusPill tone="critical">{tf(t("cannotReachBackend"), { msg: health.error })}</StatusPill>
              ) : (
                <StatusPill tone="healthy">{tf(t("connectedWith"), { msg: health.data?.status ?? "ok" })}</StatusPill>
              )}
              <button onClick={() => void health.reload()} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                {t("check")}
              </button>
            </div>
          </Field>
          <Field label={t("requestTimeoutSeconds")}>
            <Input type="number" min={1} max={300} value={form.requestTimeout} onChange={(e) => set("requestTimeout", e.target.value)} className="w-28 font-mono" disabled={loadFailed} />
          </Field>
          <SwitchRow label={t("rateLimiting")} description={t("enableRateLimitingAlerts")}>
            <Switch checked={form.rateLimiting} onCheckedChange={(v) => set("rateLimiting", v)} disabled={loadFailed} />
          </SwitchRow>
        </Card>

        <Card title={t("security")} note={t("platformSettingsNote")} loading={res.loading}>
          <Field label={t("jwtTokenExpiryHours")}>
            <Input type="number" min={1} max={720} value={form.jwtExpiry} onChange={(e) => set("jwtExpiry", e.target.value)} className="w-28 font-mono" disabled={loadFailed} />
          </Field>
          <Field label={t("maxFailedLoginAttempts")}>
            <Input type="number" min={1} max={20} value={form.maxLoginAttempts} onChange={(e) => set("maxLoginAttempts", e.target.value)} className="w-28 font-mono" disabled={loadFailed} />
          </Field>
          <SwitchRow label={t("requireMfa")} description={t("enforce2faForAdmins")}>
            <Switch checked={form.requireMFA} onCheckedChange={(v) => set("requireMFA", v)} disabled={loadFailed} />
          </SwitchRow>
        </Card>

        <Card title={t("maintenance")} loading={res.loading}>
          <Field label={t("environment")}>
            <Select value={form.environment} onValueChange={(v) => set("environment", v)} disabled={loadFailed}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="production">{t("production")}</SelectItem>
                <SelectItem value="staging">{t("staging")}</SelectItem>
                <SelectItem value="development">{t("development")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <SwitchRow label={t("maintenanceMode")} description={t("showMaintenanceBanner")}>
            <Switch checked={form.maintenanceMode} onCheckedChange={(v) => set("maintenanceMode", v)} disabled={loadFailed} />
          </SwitchRow>
          {form.maintenanceMode && (
            <p className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
              {t("maintenanceModeOnNotice")}
            </p>
          )}
        </Card>

        <Card title={t("logging")} loading={res.loading}>
          <Field label={t("logLevel")}>
            <Select value={form.logLevel} onValueChange={(v) => set("logLevel", v)} disabled={loadFailed}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="debug">{t("debug")}</SelectItem>
                <SelectItem value="info">{t("info")}</SelectItem>
                <SelectItem value="warn">{t("warning")}</SelectItem>
                <SelectItem value="error">{t("errorLevel")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <SwitchRow label={t("queryLogging")} description={t("logAllDbQueries")}>
            <Switch checked={form.queryLogging} onCheckedChange={(v) => set("queryLogging", v)} disabled={loadFailed} />
          </SwitchRow>
        </Card>

        <TokenInspector />
        <Sessions />
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 lg:pl-60">
          <div className="flex w-full max-w-xl items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
            <span className="text-sm text-foreground">{t("unsavedChanges")}</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>{t("discardChanges")}</Button>
              <Button onClick={() => void save()} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? t("saving") : t("save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function Card({ title, note, loading, children, className }: {
  title: string; note?: string; loading?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-xl border bg-card ${className ?? ""}`}>
      <div className="border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="space-y-4 p-5">
        {loading ? (<><Skeleton className="h-9" /><Skeleton className="h-9" /><Skeleton className="h-9" /></>) : children}
      </div>
    </section>
  );
}

function TokenInspector() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const { token } = useAuth();
  const [show, setShow] = useState(false);
  const payload = useMemo(() => (token ? decodeJwt(token) : null), [token]);
  const exp = typeof payload?.exp === "number" ? payload.exp : undefined;
  const iat = typeof payload?.iat === "number" ? payload.iat : undefined;
  const expired = exp ? exp * 1000 < Date.now() : false;

  const masked = token ? `${token.slice(0, 8)}${"•".repeat(24)}${token.slice(-6)}` : "";

  const copy = async () => {
    if (token && (await copyText(token))) toast.success(t("copiedBang"));
    else toast.error(t("copyFailed"));
  };

  return (
    <Card title={t("apiTokenInspector")}>
      {!token ? (
        <p className="text-sm text-muted-foreground">{t("noAuthTokenFound")}</p>
      ) : (
        <>
          <Field label={t("currentToken")}>
            <div className="flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-muted p-2.5 font-mono text-xs text-foreground">{show ? token : masked}</code>
              <Button variant="ghost" size="icon" onClick={() => setShow((v) => !v)} aria-label={show ? t("hideToken") : t("showToken")}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => void copy()} aria-label={t("copyToken")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </Field>
          {payload && (
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <Meta label={t("issuedAt")}>{iat ? formatDateTime(new Date(iat * 1000).toISOString(), language) : "—"}</Meta>
              <Meta label={t("expiresAt")}>
                <span className={expired ? "text-status-critical" : undefined}>
                  {exp ? formatDateTime(new Date(exp * 1000).toISOString(), language) : "—"}
                  {expired && t("expiredSuffix")}
                </span>
              </Meta>
              <Meta label={t("subjectRole")}>{String(payload.role ?? payload.sub ?? "—")}</Meta>
            </dl>
          )}
        </>
      )}
    </Card>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-0.5 text-xs text-muted-foreground">{label}</dt>
      <dd className="tnum font-mono text-xs text-foreground">{children}</dd>
    </div>
  );
}

function userAgentLabel(ua: string, unknown: string): string {
  if (!ua) return unknown;
  const os = /Windows/i.test(ua) ? "Windows" : /Android/i.test(ua) ? "Android" : /iPhone|iPad|iOS/i.test(ua) ? "iOS" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "—";
  const browser = /Edg\//i.test(ua) ? "Edge" : /Chrome\//i.test(ua) ? "Chrome" : /Firefox\//i.test(ua) ? "Firefox" : /Safari\//i.test(ua) ? "Safari" : "—";
  return `${browser} · ${os}`;
}

function Sessions() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const currentSid = (token ? (decodeJwt(token)?.sid as string | undefined) : undefined) ?? null;
  const res = useResource<DeveloperSession[]>(listMySessions, t("sessionsLoadFailed"));
  const [revoking, setRevoking] = useState<string | null>(null);

  const revoke = async (s: DeveloperSession) => {
    setRevoking(s.id);
    try {
      await revokeSession(s.id);
      toast.success(t("sessionSignedOut"));
      if (s.id === currentSid) {
        logout(); // clears the token *and* the cached user
        navigate("/login");
        return;
      }
      res.setData((d) => (d ?? []).filter((x) => x.id !== s.id));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("failedToSignOutSession"));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <Card title={t("activeSessions")}>
      {res.loading ? (
        <Skeleton className="h-14" />
      ) : res.error ? (
        <ErrorNotice className="mb-0" message={res.error} onRetry={() => void res.reload()} />
      ) : (res.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noActiveSessionsFound")}</p>
      ) : (
        <ul className="space-y-2">
          {(res.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {userAgentLabel(s.userAgent, t("unknownDevice"))}
                  {s.id === currentSid && <StatusPill tone="accent" dot={false}>{t("thisDevice")}</StatusPill>}
                </p>
                <p className="tnum truncate font-mono text-xs text-muted-foreground">
                  {s.ipAddress || "—"} · {tf(t("lastActive"), { time: formatDateTime(s.lastSeenAt, language) })}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={revoking === s.id} onClick={() => void revoke(s)}>
                {revoking === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("signOut")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

