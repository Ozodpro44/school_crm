import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { useNotify } from "@/hooks/use-notify";
import {
  listMessageHistory,
  sendMassMessage,
  listClasses,
  MessageLogEntry,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, MessageSquare, Users, CheckCircle, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useBranch } from "@/context/BranchContext";

const TEMPLATES = [
  { key: "payment_due", text: "Hurmatli ota-ona, {name} uchun oylik to'lov muddati yaqinlashmoqda. Iltimos, to'lovni amalga oshiring." },
  { key: "payment_received", text: "Hurmatli ota-ona, {name} ning to'lovi qabul qilindi. Rahmat!" },
  { key: "absent_notice", text: "Hurmatli ota-ona, {name} bugun darsga kelmadi. Iltimos, bog'laning." },
  { key: "general", text: "" },
];

export default function MessagingPage() {
  const language = useLanguage();
  const { currentBranch } = useBranch();

  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<MessageLogEntry[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);

  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"compose" | "history">("compose");

  const t = (key: string) => getTranslation(key, language);
  const notify = useNotify();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const branchId = currentBranch?.id;
    if (!branchId) return;
    setIsLoading(true);
    try {
      const [historyData, classesData] = await Promise.all([
        listMessageHistory(branchId),
        listClasses(branchId),
      ]);
      setHistory(historyData);
      setClasses(classesData);
    } catch {
      notify.error(t("error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const tmpl = TEMPLATES.find((t) => t.key === templateKey);
    if (tmpl) setMessage(tmpl.text);
  };

  const handleSend = async () => {
    const branchId = currentBranch?.id;
    if (!branchId || !message.trim()) return;
    setIsSending(true);
    try {
      const filters: any = {};
      if (classFilter !== "all") filters.classIds = [classFilter];
      if (paymentFilter !== "all") filters.paymentStatus = paymentFilter;

      const result = await sendMassMessage({
        branchId,
        message: message.trim(),
        templateKey: selectedTemplate,
        filters,
      });

      setHistory([result, ...history]);
      notify.success(t("messageSent"), `${result.recipientsCount} recipients, ${result.deliveredCount} delivered`);
      setMessage("");
      setSelectedTemplate("");
      setActiveTab("history");
    } catch {
      notify.error(t("error"));
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        {/* Tab bar */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-px">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Compose panel */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <Skeleton className="h-5 w-36" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-28 w-full rounded-md" />
            </div>
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
          {/* Summary sidebar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <Skeleton className="h-5 w-28" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-slate-900 dark:text-slate-100">
          {t("messaging")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Send Telegram messages to student parents
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-1">
          {(["compose", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {tab === "compose" ? <Send className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              {tab === "compose" ? t("composeMessage") : t("messageHistory")}
              {tab === "history" && history.length > 0 && (
                <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs">
                  {history.length}
                </Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Compose panel */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("composeMessage")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Templates */}
                <div className="space-y-2">
                  <Label>{t("useTemplate")}</Label>
                  <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template or write custom…" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATES.map((tmpl) => (
                        <SelectItem key={tmpl.key} value={tmpl.key}>
                          {tmpl.key === "payment_due" ? "Payment reminder" :
                           tmpl.key === "payment_received" ? "Payment received" :
                           tmpl.key === "absent_notice" ? "Absence notice" :
                           "Custom message"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("message")} *</Label>
                  <Textarea
                    placeholder="Write your message… Use {name} to insert student name."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[120px]"
                  />
                  <p className="text-xs text-slate-400">Use <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{name}"}</code> to insert student name.</p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSend}
                  disabled={isSending || !message.trim()}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isSending ? t("processing") : t("sendMessage")}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Filters panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("recipientFilter")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("class")}</Label>
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allClasses")}</SelectItem>
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("paymentStatus")}</Label>
                  <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allStatuses")}</SelectItem>
                      <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
                      <SelectItem value="paid">{t("paid")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                  Only students with a Telegram Chat ID set will receive messages. Set the chat ID on the student's profile.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>{t("noMessagesYet")}</p>
              </CardContent>
            </Card>
          ) : (
            history.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <p className="text-slate-900 dark:text-slate-100">{entry.message}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(entry.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                          <Users className="w-3.5 h-3.5" />{entry.recipientsCount}
                        </div>
                        <div className="text-xs text-slate-400">{t("recipients")}</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                          <CheckCircle className="w-3.5 h-3.5" />{entry.deliveredCount}
                        </div>
                        <div className="text-xs text-slate-400">{t("delivered")}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
