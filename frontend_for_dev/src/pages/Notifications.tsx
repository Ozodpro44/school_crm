import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Bell,
  Mail,
  MessageSquare,
  AlertTriangle,
  Server,
  CreditCard,
  Settings,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  email: boolean;
  telegram: boolean;
  slack: boolean;
  icon: typeof AlertTriangle;
  category: "system" | "billing" | "security";
}

const notificationSettings: NotificationSetting[] = [
  {
    id: "server_down",
    title: "Server Down Alert",
    description: "Get notified when any server or service goes offline",
    email: true,
    telegram: true,
    slack: true,
    icon: Server,
    category: "system",
  },
  {
    id: "critical_error",
    title: "Critical Errors",
    description: "Immediate alerts for critical application errors",
    email: true,
    telegram: true,
    slack: true,
    icon: AlertTriangle,
    category: "system",
  },
  {
    id: "high_latency",
    title: "High Latency Warning",
    description: "Alert when API response time exceeds threshold",
    email: true,
    telegram: false,
    slack: true,
    icon: Clock,
    category: "system",
  },
  {
    id: "subscription_expiry",
    title: "Subscription Expiry",
    description: "Notify before branch subscriptions expire",
    email: true,
    telegram: false,
    slack: false,
    icon: CreditCard,
    category: "billing",
  },
  {
    id: "payment_failed",
    title: "Payment Failures",
    description: "Alert on failed payment transactions",
    email: true,
    telegram: true,
    slack: true,
    icon: CreditCard,
    category: "billing",
  },
  {
    id: "failed_login",
    title: "Failed Login Attempts",
    description: "Multiple failed login attempts from same IP",
    email: true,
    telegram: true,
    slack: false,
    icon: AlertTriangle,
    category: "security",
  },
];

const recentAlerts = [
  {
    id: "1",
    title: "Payment gateway timeout resolved",
    time: "2 hours ago",
    type: "success",
    channel: "Email, Telegram",
  },
  {
    id: "2",
    title: "High latency detected on /api/students",
    time: "4 hours ago",
    type: "warning",
    channel: "Email, Slack",
  },
  {
    id: "3",
    title: "Subscription expiring: Kazan Academy",
    time: "1 day ago",
    type: "warning",
    channel: "Email",
  },
  {
    id: "4",
    title: "Critical error in payment module",
    time: "2 days ago",
    type: "error",
    channel: "All channels",
  },
];

export default function Notifications() {
  const [settings, setSettings] = useState(notificationSettings);

  const toggleSetting = (id: string, channel: "email" | "telegram" | "slack") => {
    setSettings((prev) =>
      prev.map((setting) =>
        setting.id === id ? { ...setting, [channel]: !setting[channel] } : setting
      )
    );
  };

  const systemSettings = settings.filter((s) => s.category === "system");
  const billingSettings = settings.filter((s) => s.category === "billing");
  const securitySettings = settings.filter((s) => s.category === "security");

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications & Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how you receive system alerts
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Configure Integrations
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Settings */}
        <div className="xl:col-span-2 space-y-6">
          {/* System Alerts */}
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                System Alerts
              </h3>
            </div>
            <div className="divide-y divide-border">
              {systemSettings.map((setting) => (
                <div key={setting.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center mt-0.5">
                        <setting.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{setting.title}</p>
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 ml-11">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={setting.email}
                        onCheckedChange={() => toggleSetting(setting.id, "email")}
                      />
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={setting.telegram}
                        onCheckedChange={() => toggleSetting(setting.id, "telegram")}
                      />
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Telegram</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={setting.slack}
                        onCheckedChange={() => toggleSetting(setting.id, "slack")}
                      />
                      <span className="text-sm text-muted-foreground">Slack</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Billing Alerts */}
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-status-healthy" />
                Billing Alerts
              </h3>
            </div>
            <div className="divide-y divide-border">
              {billingSettings.map((setting) => (
                <div key={setting.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-status-healthy/15 flex items-center justify-center mt-0.5">
                        <setting.icon className="w-4 h-4 text-status-healthy" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{setting.title}</p>
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 ml-11">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={setting.email}
                        onCheckedChange={() => toggleSetting(setting.id, "email")}
                      />
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={setting.telegram}
                        onCheckedChange={() => toggleSetting(setting.id, "telegram")}
                      />
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Telegram</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={setting.slack}
                        onCheckedChange={() => toggleSetting(setting.id, "slack")}
                      />
                      <span className="text-sm text-muted-foreground">Slack</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Alerts */}
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-status-warning" />
                Security Alerts
              </h3>
            </div>
            <div className="divide-y divide-border">
              {securitySettings.map((setting) => (
                <div key={setting.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-status-warning/15 flex items-center justify-center mt-0.5">
                        <setting.icon className="w-4 h-4 text-status-warning" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{setting.title}</p>
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 ml-11">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={setting.email}
                        onCheckedChange={() => toggleSetting(setting.id, "email")}
                      />
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={setting.telegram}
                        onCheckedChange={() => toggleSetting(setting.id, "telegram")}
                      />
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Telegram</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={setting.slack}
                        onCheckedChange={() => toggleSetting(setting.id, "slack")}
                      />
                      <span className="text-sm text-muted-foreground">Slack</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="glass-card rounded-lg h-fit">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Recent Alerts
            </h3>
          </div>
          <div className="divide-y divide-border">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    alert.type === "success" && "bg-status-healthy/15",
                    alert.type === "warning" && "bg-status-warning/15",
                    alert.type === "error" && "bg-status-critical/15"
                  )}>
                    {alert.type === "success" && <CheckCircle2 className="w-4 h-4 text-status-healthy" />}
                    {alert.type === "warning" && <AlertTriangle className="w-4 h-4 text-status-warning" />}
                    {alert.type === "error" && <AlertTriangle className="w-4 h-4 text-status-critical" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{alert.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {alert.time}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{alert.channel}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
