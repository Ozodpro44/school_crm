import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Settings as SettingsIcon,
  Server,
  Database,
  Shield,
  Bell,
  Globe,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
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

const SETTINGS_KEY = "dev_dashboard_settings";

const defaultSettings = {
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

type Settings = typeof defaultSettings;

function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...defaultSettings, ...JSON.parse(saved) };
  } catch {}
  return defaultSettings;
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [saving, setSaving] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"loading" | "ok" | "error">("loading");
  const apiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

  useEffect(() => {
    apiClient
      .healthCheck()
      .then(() => setHealthStatus("ok"))
      .catch(() => setHealthStatus("error"));
  }, []);

  const set = (key: keyof Settings, value: unknown) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const setNotif = (key: keyof Settings["notifications"], value: boolean) =>
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      await new Promise((r) => setTimeout(r, 300));
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure system preferences and integrations
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Configuration */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              API Configuration
            </h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Backend API URL</Label>
              <Input
                value={apiUrl}
                readOnly
                className="bg-background font-mono text-sm opacity-70 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">Configured via VITE_API_BASE_URL environment variable</p>
            </div>
            <div className="space-y-2">
              <Label>Backend Status</Label>
              <div className="flex items-center gap-2">
                {healthStatus === "loading" && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Checking...</span>
                  </>
                )}
                {healthStatus === "ok" && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-status-healthy" />
                    <span className="text-sm text-status-healthy">Connected and healthy</span>
                  </>
                )}
                {healthStatus === "error" && (
                  <>
                    <XCircle className="w-4 h-4 text-status-critical" />
                    <span className="text-sm text-status-critical">Cannot reach backend</span>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Request Timeout (seconds)</Label>
              <Input
                type="number"
                value={settings.requestTimeout}
                onChange={(e) => set("requestTimeout", e.target.value)}
                className="bg-background w-32"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Rate Limiting</p>
                <p className="text-sm text-muted-foreground">Enable API rate limiting</p>
              </div>
              <Switch
                checked={settings.rateLimiting}
                onCheckedChange={(v) => set("rateLimiting", v)}
              />
            </div>
          </div>
        </div>

        {/* Database Settings */}
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
                <p className="text-sm text-muted-foreground">Log all database queries</p>
              </div>
              <Switch
                checked={settings.queryLogging}
                onCheckedChange={(v) => set("queryLogging", v)}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Slow Query Alerts</p>
                <p className="text-sm text-muted-foreground">Alert on queries &gt; 1000ms</p>
              </div>
              <Switch
                checked={settings.slowQueryAlerts}
                onCheckedChange={(v) => set("slowQueryAlerts", v)}
              />
            </div>
          </div>
        </div>

        {/* Security Settings */}
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
                <p className="text-sm text-muted-foreground">Enforce 2FA for all admins</p>
              </div>
              <Switch
                checked={settings.requireMFA}
                onCheckedChange={(v) => set("requireMFA", v)}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">IP Whitelisting</p>
                <p className="text-sm text-muted-foreground">Restrict admin access by IP</p>
              </div>
              <Switch
                checked={settings.ipWhitelisting}
                onCheckedChange={(v) => set("ipWhitelisting", v)}
              />
            </div>
          </div>
        </div>

        {/* Environment */}
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
                <p className="text-sm text-muted-foreground">Disable access for all users</p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(v) => set("maintenanceMode", v)}
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
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
                ["errorAlerts", "Error Alerts", "Get notified when error rate spikes"],
                ["deployAlerts", "Deploy Alerts", "Notifications on new deployments"],
                ["securityAlerts", "Security Alerts", "Unusual login or access attempts"],
                ["weeklyReport", "Weekly Report", "Summary of metrics every Monday"],
              ] as [keyof Settings["notifications"], string, string][]
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
    </DashboardLayout>
  );
}
