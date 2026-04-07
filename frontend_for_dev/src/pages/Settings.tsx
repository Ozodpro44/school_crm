import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Server,
  Database,
  Shield,
  Bell,
  Globe,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/services/api-client";
import { toast } from "sonner";

// Default values shown before backend data loads
const defaults = {
  requestTimeout: "30",
  rateLimiting: true,
  connectionPool: "20",
  queryTimeout: "5000",
  queryLogging: false,
  slowQueryAlerts: true,
  jwtExpiry: "24",
  maxLoginAttempts: "5",
  requireMFA: false,
  ipWhitelisting: false,
  environment: "production",
  logLevel: "info",
  maintenanceMode: false,
  notifications: {
    errorAlerts: true,
    deployAlerts: true,
    securityAlerts: true,
    weeklyReport: false,
  },
};

type DevSettings = typeof defaults;

function mergeWithDefaults(raw: Record<string, any>): DevSettings {
  return {
    ...defaults,
    ...raw,
    notifications: {
      ...defaults.notifications,
      ...(raw.notifications || {}),
    },
  };
}

export default function Settings() {
  const [settings, setSettings] = useState<DevSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"loading" | "ok" | "error">("loading");
  const [healthDetail, setHealthDetail] = useState<string>("");

  const apiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

  // ── Load from backend on mount ───────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await apiClient.getDevSettings();
      setSettings(mergeWithDefaults(raw));
      setDirty(false);
    } catch {
      // Backend may not have settings yet (new account) — use defaults silently
      setSettings(defaults);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setHealthStatus("loading");
    try {
      const h = await apiClient.healthCheck();
      setHealthStatus("ok");
      setHealthDetail(h?.status || "healthy");
    } catch (e) {
      setHealthStatus("error");
      setHealthDetail(e instanceof Error ? e.message : "unreachable");
    }
  }, []);

  useEffect(() => {
    loadSettings();
    checkHealth();
  }, [loadSettings, checkHealth]);

  // ── Setters ──────────────────────────────────────────────────────────────────

  const set = <K extends keyof DevSettings>(key: K, value: DevSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const setNotif = (key: keyof DevSettings["notifications"], value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
    setDirty(true);
  };

  // ── Save to backend ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await apiClient.updateDevSettings(settings as Record<string, any>);
      setSettings(mergeWithDefaults(saved));
      setDirty(false);
      toast.success("Settings saved to backend");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    await loadSettings();
    toast.info("Changes discarded");
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Developer dashboard preferences — saved per account to the backend
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="outline" onClick={handleDiscard} disabled={saving}>
              Discard
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── API Configuration ──────────────────────────────────────────────── */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              API Configuration
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* API URL (read-only) */}
            <div className="space-y-2">
              <Label>Backend API URL</Label>
              <Input
                value={apiUrl}
                readOnly
                className="bg-background font-mono text-sm opacity-60 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">Set via VITE_API_BASE_URL env variable</p>
            </div>

            {/* Live health status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Backend Status</Label>
                <button
                  onClick={checkHealth}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Check
                </button>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30">
                {healthStatus === "loading" && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Checking...</span>
                  </>
                )}
                {healthStatus === "ok" && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-status-healthy" />
                    <span className="text-sm text-status-healthy">Connected — {healthDetail}</span>
                  </>
                )}
                {healthStatus === "error" && (
                  <>
                    <XCircle className="w-4 h-4 text-status-critical" />
                    <span className="text-sm text-status-critical">Cannot reach backend</span>
                    {healthDetail && (
                      <span className="text-xs text-muted-foreground ml-1">({healthDetail})</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Request timeout */}
            <div className="space-y-2">
              <Label>Request Timeout (seconds)</Label>
              <Input
                type="number"
                value={settings.requestTimeout}
                onChange={(e) => set("requestTimeout", e.target.value)}
                className="bg-background w-32"
              />
            </div>

            {/* Rate limiting */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Rate Limiting</p>
                <p className="text-sm text-muted-foreground">Enable API rate limiting alerts in dashboard</p>
              </div>
              <Switch
                checked={settings.rateLimiting}
                onCheckedChange={(v) => set("rateLimiting", v)}
              />
            </div>
          </div>
        </div>

        {/* ── Database Settings ──────────────────────────────────────────────── */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Database className="w-4 h-4 text-status-healthy" />
              Database Settings
            </h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Connection Pool Size</Label>
              <Input
                type="number"
                value={settings.connectionPool}
                onChange={(e) => set("connectionPool", e.target.value)}
                className="bg-background w-32"
              />
            </div>
            <div className="space-y-2">
              <Label>Query Timeout (ms)</Label>
              <Input
                type="number"
                value={settings.queryTimeout}
                onChange={(e) => set("queryTimeout", e.target.value)}
                className="bg-background w-32"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Query Logging</p>
                <p className="text-sm text-muted-foreground">Show DB query logs in the Logs page</p>
              </div>
              <Switch
                checked={settings.queryLogging}
                onCheckedChange={(v) => set("queryLogging", v)}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Slow Query Alerts</p>
                <p className="text-sm text-muted-foreground">Highlight queries &gt; 1000ms as incidents</p>
              </div>
              <Switch
                checked={settings.slowQueryAlerts}
                onCheckedChange={(v) => set("slowQueryAlerts", v)}
              />
            </div>
          </div>
        </div>

        {/* ── Security Settings ──────────────────────────────────────────────── */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-status-warning" />
              Security Settings
            </h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>JWT Token Expiry (hours)</Label>
              <Input
                type="number"
                value={settings.jwtExpiry}
                onChange={(e) => set("jwtExpiry", e.target.value)}
                className="bg-background w-32"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Failed Login Attempts</Label>
              <Input
                type="number"
                value={settings.maxLoginAttempts}
                onChange={(e) => set("maxLoginAttempts", e.target.value)}
                className="bg-background w-32"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Require MFA</p>
                <p className="text-sm text-muted-foreground">Enforce 2FA for all admin accounts</p>
              </div>
              <Switch
                checked={settings.requireMFA}
                onCheckedChange={(v) => set("requireMFA", v)}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">IP Whitelisting</p>
                <p className="text-sm text-muted-foreground">Restrict admin access by IP address</p>
              </div>
              <Switch
                checked={settings.ipWhitelisting}
                onCheckedChange={(v) => set("ipWhitelisting", v)}
              />
            </div>
          </div>
        </div>

        {/* ── Environment ───────────────────────────────────────────────────── */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-status-info" />
              Environment
            </h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select
                value={settings.environment}
                onValueChange={(v) => set("environment", v)}
              >
                <SelectTrigger className="w-48 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Log Level</Label>
              <Select
                value={settings.logLevel}
                onValueChange={(v) => set("logLevel", v)}
              >
                <SelectTrigger className="w-48 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Maintenance Mode</p>
                <p className="text-sm text-muted-foreground">Show maintenance banner across dashboard</p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(v) => set("maintenanceMode", v)}
              />
            </div>
          </div>
        </div>

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <div className="glass-card rounded-lg overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Notification Preferences
            </h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              [
                ["errorAlerts",    "Error Alerts",    "Alert when error rate spikes in logs"],
                ["deployAlerts",   "Deploy Alerts",   "Notify on new deployments detected"],
                ["securityAlerts", "Security Alerts", "Unusual login or suspicious access attempts"],
                ["weeklyReport",   "Weekly Report",   "Summary digest of metrics every Monday"],
              ] as [keyof DevSettings["notifications"], string, string][]
            ).map(([key, title, desc]) => (
              <div key={key} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={settings.notifications[key]}
                  onCheckedChange={(v) => setNotif(key, v)}
                />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Dirty indicator */}
      {dirty && (
        <p className="text-xs text-muted-foreground text-center mt-6">
          You have unsaved changes — click Save Changes to persist them to the backend.
        </p>
      )}
    </DashboardLayout>
  );
}
