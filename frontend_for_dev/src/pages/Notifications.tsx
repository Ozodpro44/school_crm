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
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);
  const [integrations, setIntegrations] = useState({
    email: { enabled: true, address: "admin@wonderkids.school" },
    telegram: { enabled: true, botToken: "", chatId: "" },
    slack: { enabled: false, webhookUrl: "" },
  });

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
                Set up your notification channels for receiving alerts.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Email Integration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <Label className="font-medium">Email Notifications</Label>
                  </div>
                  <Switch
                    checked={integrations.email.enabled}
                    onCheckedChange={(checked) =>
                      setIntegrations((prev) => ({
                        ...prev,
                        email: { ...prev.email, enabled: checked },
                      }))
                    }
                  />
                </div>
                {integrations.email.enabled && (
                  <div className="ml-6">
                    <Label htmlFor="email-address" className="text-sm text-muted-foreground">
                      Email Address
                    </Label>
                    <Input
                      id="email-address"
                      type="email"
                      value={integrations.email.address}
                      onChange={(e) =>
                        setIntegrations((prev) => ({
                          ...prev,
                          email: { ...prev.email, address: e.target.value },
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              {/* Telegram Integration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#0088cc]" />
                    <Label className="font-medium">Telegram</Label>
                  </div>
                  <Switch
                    checked={integrations.telegram.enabled}
                    onCheckedChange={(checked) =>
                      setIntegrations((prev) => ({
                        ...prev,
                        telegram: { ...prev.telegram, enabled: checked },
                      }))
                    }
                  />
                </div>
                {integrations.telegram.enabled && (
                  <div className="ml-6 space-y-3">
                    <div>
                      <Label htmlFor="telegram-token" className="text-sm text-muted-foreground">
                        Bot Token
                      </Label>
                      <Input
                        id="telegram-token"
                        type="password"
                        placeholder="123456:ABC-DEF1234ghIkl..."
                        value={integrations.telegram.botToken}
                        onChange={(e) =>
                          setIntegrations((prev) => ({
                            ...prev,
                            telegram: { ...prev.telegram, botToken: e.target.value },
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="telegram-chat" className="text-sm text-muted-foreground">
                        Chat ID
                      </Label>
                      <Input
                        id="telegram-chat"
                        placeholder="-1001234567890"
                        value={integrations.telegram.chatId}
                        onChange={(e) =>
                          setIntegrations((prev) => ({
                            ...prev,
                            telegram: { ...prev.telegram, chatId: e.target.value },
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <a
                      href="https://core.telegram.org/bots#how-do-i-create-a-bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                    >
                      How to create a Telegram bot <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Slack Integration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#E01E5A">
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                    </svg>
                    <Label className="font-medium">Slack</Label>
                  </div>
                  <Switch
                    checked={integrations.slack.enabled}
                    onCheckedChange={(checked) =>
                      setIntegrations((prev) => ({
                        ...prev,
                        slack: { ...prev.slack, enabled: checked },
                      }))
                    }
                  />
                </div>
                {integrations.slack.enabled && (
                  <div className="ml-6 space-y-3">
                    <div>
                      <Label htmlFor="slack-webhook" className="text-sm text-muted-foreground">
                        Webhook URL
                      </Label>
                      <Input
                        id="slack-webhook"
                        type="password"
                        placeholder="https://hooks.slack.com/services/..."
                        value={integrations.slack.webhookUrl}
                        onChange={(e) =>
                          setIntegrations((prev) => ({
                            ...prev,
                            slack: { ...prev.slack, webhookUrl: e.target.value },
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <a
                      href="https://api.slack.com/messaging/webhooks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                    >
                      How to create a Slack webhook <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsIntegrationsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setIsIntegrationsOpen(false)}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
