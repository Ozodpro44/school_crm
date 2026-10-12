import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "@/lib/api";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { useBranch } from "@/context/BranchContext";
import { useNotify } from "@/hooks/use-notify";
import { DataTable, Column } from "@/components/DataTable";
import { cn } from "@/lib/utils";

const TYPE_DOT: Record<AppNotification["type"], string> = {
  payment: "bg-green-500",
  student: "bg-orange-500",
  system: "bg-blue-500",
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// This page exists because the notification bell's "View History" link
// (src/components/Layout.tsx) points to /notifications, which previously
// didn't exist — clicking it 404'd. The bell itself only shows the last 20
// via a popover; this is the full, page-form history view.
export default function NotificationsPage() {
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const notify = useNotify();
  const { currentBranch } = useBranch();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentBranch?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getNotifications(200);
      setNotifications(data);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [currentBranch?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await markNotificationRead(id);
    } catch {
      notify.error(t("error"), t("failedToUpdate"));
      load();
    }
  };

  const handleMarkAll = async () => {
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      notify.error(t("error"), t("failedToUpdate"));
      setNotifications(previous);
    }
  };

  const columns: Column<AppNotification>[] = [
    {
      key: "status",
      header: "",
      cellClassName: "w-6",
      render: (n) => (
        <span
          className={cn(
            "block w-2 h-2 rounded-full",
            TYPE_DOT[n.type],
            !n.isRead && "ring-4 ring-indigo-500/10"
          )}
        />
      ),
    },
    {
      key: "title",
      header: t("title") || "Title",
      render: (n) => (
        <div>
          <p
            className={cn(
              "text-sm font-semibold",
              !n.isRead ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"
            )}
          >
            {n.title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{n.message}</p>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: t("auditTime"),
      cellClassName: "text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap w-40",
      hideOnMobile: true,
      render: (n) => formatTime(n.createdAt),
    },
    {
      key: "actions",
      header: "",
      cellClassName: "w-32 text-right",
      render: (n) =>
        !n.isRead ? (
          <Button variant="ghost" size="sm" onClick={() => handleMarkRead(n.id)}>
            {t("markRead")}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display text-brand-gradient flex items-center gap-3">
            <Bell className="w-8 h-8 text-indigo-600" />
            {t("notificationHistory")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            {t("notificationHistoryDesc")}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAll} className="gap-1.5">
            <CheckCheck className="w-4 h-4" />
            {t("markAllRead")}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {notifications.length.toLocaleString()} {t("notifications")}
            {unreadCount > 0 && (
              <span className="ml-1 text-indigo-500">({unreadCount})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={notifications}
            loading={loading}
            skeletonRows={8}
            emptyIcon={Bell}
            emptyTitle={t("noNotificationsYet")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
