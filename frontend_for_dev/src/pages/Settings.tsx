import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Settings as SettingsIcon,
  Server,
  Database,
  Shield,
  Bell,
  Palette,
  Globe,
  Key,
  Save,
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

export default function Settings() {
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
        <Button className="gap-2">
          <Save className="w-4 h-4" />
          Save Changes
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
                defaultValue="https://api.wonderkids.ru"
                className="bg-background font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>API Port</Label>
              <Input
                defaultValue="8080"
                className="bg-background font-mono text-sm w-32"
              />
            </div>
            <div className="space-y-2">
              <Label>Request Timeout (seconds)</Label>
              <Input
                type="number"
                defaultValue="30"
                className="bg-background w-32"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Rate Limiting</p>
                <p className="text-sm text-muted-foreground">Enable API rate limiting</p>
              </div>
              <Switch defaultChecked />
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
                defaultValue="20"
                className="bg-background w-32"
              />
            </div>
            <div className="space-y-2">
              <Label>Query Timeout (ms)</Label>
              <Input
                type="number"
                defaultValue="5000"
                className="bg-background w-32"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Query Logging</p>
                <p className="text-sm text-muted-foreground">Log all database queries</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Slow Query Alerts</p>
                <p className="text-sm text-muted-foreground">Alert on queries {">"} 1000ms</p>
              </div>
              <Switch defaultChecked />
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
                defaultValue="24"
                className="bg-background w-32"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Failed Login Attempts</Label>
              <Input
                type="number"
                defaultValue="5"
                className="bg-background w-32"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Require MFA</p>
                <p className="text-sm text-muted-foreground">Enforce 2FA for all admins</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">IP Whitelisting</p>
                <p className="text-sm text-muted-foreground">Restrict admin access by IP</p>
              </div>
              <Switch />
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
              <Select defaultValue="production">
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
              <Select defaultValue="info">
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
              <Switch />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
