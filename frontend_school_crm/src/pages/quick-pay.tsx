import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import {
  apiRequest,
  searchStudentsWithPaymentStatus,
  listClasses,
  type StudentPaymentInfo,
  type Class,
} from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { useNotify } from "@/hooks/use-notify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Zap,
  Users,
  QrCode,
  Search,
  Printer,
  CreditCard,
  Banknote,
  Building2,
  CheckSquare,
  Square,
  AlertCircle,
  Camera,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "collect" | "bulk" | "scan";
type PayMethod = "cash" | "click" | "bank" | "terminal";

interface BulkEntry {
  studentId: string;
  amount: number;
  paymentMethod: string;
}

interface BulkResult {
  studentId: string;
  payment?: { id: string; amount: number; month: string; year: number; invoiceNumber: string };
  error?: string;
}

interface ReceiptData {
  studentName: string;
  amount: number;
  month: string;
  year: number;
  method: string;
  invoiceNumber: string;
  branchName: string;
  paidAt: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function bulkPay(branchId: string, paymentMethod: string, entries: BulkEntry[]) {
  return apiRequest<{ results: BulkResult[]; succeeded: number; failed: number }>(
    "/payments/bulk",
    {
      method: "POST",
      body: JSON.stringify({ branchId, paymentMethod, entries }),
    }
  );
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function currentMonthLabel() {
  return new Date().toLocaleString("default", { month: "long", year: "numeric" });
}

const PAY_METHODS: { id: PayMethod; label: string; icon: React.ReactNode }[] = [
  { id: "cash",     label: "Cash",        icon: <Banknote  className="w-4 h-4" /> },
  { id: "click",    label: "Click.uz",    icon: <CreditCard className="w-4 h-4" /> },
  { id: "bank",     label: "Bank",        icon: <Building2  className="w-4 h-4" /> },
  { id: "terminal", label: "Terminal",    icon: <CreditCard className="w-4 h-4" /> },
];

// ─── Receipt modal ────────────────────────────────────────────────────────────

function ReceiptModal({ data, onClose }: { data: ReceiptData | null; onClose: () => void }) {
  if (!data) return null;
  const print = () => {
    const win = window.open("", "_blank", "width=360,height=520");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: monospace; font-size: 13px; padding: 16px; max-width: 300px; margin: 0 auto; }
        h2 { text-align: center; font-size: 15px; margin-bottom: 8px; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
        .bold { font-weight: bold; }
        .center { text-align: center; }
        .big { font-size: 18px; font-weight: bold; text-align: center; margin: 8px 0; }
      </style></head><body>
      <h2>${data.branchName}</h2>
      <hr/>
      <div class="row"><span>Student:</span><span class="bold">${data.studentName}</span></div>
      <div class="row"><span>Month:</span><span>${data.month} ${data.year}</span></div>
      <div class="row"><span>Method:</span><span>${data.method}</span></div>
      <div class="row"><span>Invoice:</span><span>${data.invoiceNumber}</span></div>
      <div class="row"><span>Date:</span><span>${data.paidAt}</span></div>
      <hr/>
      <div class="big">${fmtMoney(data.amount)} UZS</div>
      <hr/>
      <div class="center" style="font-size:11px;color:#666;">Thank you!</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Receipt
          </DialogTitle>
        </DialogHeader>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 font-mono text-sm space-y-2">
          <div className="text-center font-bold text-base mb-1">{data.branchName}</div>
          <hr className="border-dashed border-slate-300 dark:border-slate-600" />
          <div className="flex justify-between"><span className="text-slate-500">Student</span><span className="font-semibold">{data.studentName}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Period</span><span>{data.month} {data.year}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Method</span><span>{data.method}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Invoice</span><span>{data.invoiceNumber}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Date</span><span>{data.paidAt}</span></div>
          <hr className="border-dashed border-slate-300 dark:border-slate-600" />
          <div className="text-center text-2xl font-bold text-emerald-600">{fmtMoney(data.amount)} UZS</div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
          <Button className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={print}>
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Student payment card ─────────────────────────────────────────────────────

function StudentCard({
  student,
  selected,
  paying,
  onToggle,
  onPayNow,
  payMethod,
  t,
}: {
  student: StudentPaymentInfo;
  selected: boolean;
  paying: boolean;
  onToggle: () => void;
  onPayNow: () => void;
  payMethod: PayMethod;
  t: (k: string) => string;
}) {
  const isPaid    = student.paymentStatus === "paid";
  const isPartial = student.paymentStatus === "partial";

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 transition-colors",
      isPaid ? "opacity-50" : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
      selected && "bg-indigo-50 dark:bg-indigo-950/30"
    )}>
      {/* Checkbox */}
      <button onClick={onToggle} disabled={isPaid} className="flex-shrink-0 text-slate-400 hover:text-indigo-500 transition-colors disabled:cursor-not-allowed">
        {selected
          ? <CheckSquare className="w-5 h-5 text-indigo-500" />
          : <Square className="w-5 h-5" />
        }
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{student.fullName}</p>
        <p className="text-xs text-slate-400 truncate">{student.phone}</p>
      </div>

      {/* Amount + status */}
      <div className="text-right flex-shrink-0 mr-2">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{fmtMoney(student.remaining)} UZS</p>
        {isPartial && (
          <p className="text-xs text-amber-500">{t("partial")}: {fmtMoney(student.amountPaid)}</p>
        )}
      </div>

      {/* Pay button */}
      {isPaid ? (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Paid
        </Badge>
      ) : (
        <Button
          size="sm"
          disabled={paying}
          onClick={onPayNow}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 flex-shrink-0"
        >
          {paying ? "..." : t("markAsPaid")}
        </Button>
      )}
    </div>
  );
}

// ─── QR Scanner tab ───────────────────────────────────────────────────────────

function QRScanTab({
  branchId,
  payMethod,
  branchName,
  t,
  onPaid,
}: {
  branchId: string;
  payMethod: PayMethod;
  branchName: string;
  t: (k: string) => string;
  onPaid: (receipt: ReceiptData) => void;
}) {
  const notify = useNotify();
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const [scanning, setScanning]   = useState(false);
  const [manualId, setManualId]   = useState("");
  const [student, setStudent]     = useState<StudentPaymentInfo | null>(null);
  const [paying, setPaying]       = useState(false);
  const [error, setError]         = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setScanning(true);
      scanLoop(stream);
    } catch {
      setError("Camera permission denied");
    }
  };

  const scanLoop = (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;

    // Use BarcodeDetector if available (Chrome 83+, Android)
    if ("BarcodeDetector" in window) {
      // @ts-expect-error BarcodeDetector not in TS lib yet
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const check = async () => {
        if (!stream.active) return;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const codes = await (detector as any).detect(video);
          if (codes.length > 0) {
            lookupStudent(codes[0].rawValue);
            return;
          }
        } catch {}
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }
    // Fallback: user types/pastes the student ID manually
  };

  const lookupStudent = async (studentId: string) => {
    stopCamera();
    setError("");
    try {
      const res = await searchStudentsWithPaymentStatus({ branchId, search: studentId, limit: 1 });
      const found = res.data.find((s) => s.id === studentId) ?? res.data[0] ?? null;
      if (!found) { setError(t("studentNotFound")); return; }
      setStudent(found);
    } catch {
      setError(t("studentNotFound"));
    }
  };

  const handleManual = () => {
    if (manualId.trim()) lookupStudent(manualId.trim());
  };

  const handlePay = async () => {
    if (!student || student.paymentStatus === "paid") return;
    setPaying(true);
    try {
      const res = await bulkPay(branchId, payMethod, [{
        studentId: student.id,
        amount: student.remaining,
        paymentMethod: payMethod,
      }]);
      const r = res.results[0]!;
      if (r.error) { notify.error(r.error); return; }
      onPaid({
        studentName: student.fullName,
        amount: student.remaining,
        month: r.payment?.month ?? "",
        year: r.payment?.year ?? new Date().getFullYear(),
        method: payMethod,
        invoiceNumber: r.payment?.invoiceNumber ?? "",
        branchName,
        paidAt: new Date().toLocaleString(),
      });
      setStudent(null);
      setManualId("");
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Camera view */}
      <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-[4/3] max-h-64 flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className={cn("w-full h-full object-cover", !scanning && "hidden")} />
        {!scanning && (
          <button
            onClick={startCamera}
            className="flex flex-col items-center gap-3 text-slate-400 hover:text-white transition-colors"
          >
            <Camera className="w-12 h-12" />
            <span className="text-sm">{t("scanQR")}</span>
          </button>
        )}
        {scanning && (
          <>
            {/* Targeting reticle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-white/60 rounded-2xl relative">
                <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
              </div>
            </div>
            <button onClick={stopCamera} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70">
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      <p className="text-center text-xs text-slate-400">{t("scanInstructions")}</p>

      {/* Manual input fallback */}
      <div className="flex gap-2">
        <Input
          placeholder={t("studentNotFound") + " — paste student ID"}
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleManual()}
          className="text-sm"
        />
        <Button variant="outline" onClick={handleManual} className="flex-shrink-0">
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-950 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Found student card */}
      {student && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-lg">{student.fullName}</p>
              <p className="text-sm text-slate-400">{student.phone}</p>
            </div>
            <button onClick={() => setStudent(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-0.5">{t("remaining")}</p>
              <p className="font-bold text-lg text-slate-900 dark:text-white">{fmtMoney(student.remaining)} UZS</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-0.5">{t("amountPaid")}</p>
              <p className="font-bold text-lg text-emerald-600">{fmtMoney(student.amountPaid)} UZS</p>
            </div>
          </div>
          {student.paymentStatus === "paid" ? (
            <Badge className="w-full justify-center py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Paid
            </Badge>
          ) : (
            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={paying}
              onClick={handlePay}
            >
              <Zap className="w-4 h-4" />
              {paying ? "..." : `${t("markAsPaid")} — ${fmtMoney(student.remaining)} UZS`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QuickPayPage() {
  const language = useLanguage();
  const notify = useNotify();
  const t = (k: string) => getTranslation(k, language);
  const { currentBranch } = useBranch();

  const [tab, setTab]                     = useState<TabId>("collect");
  const [payMethod, setPayMethod]         = useState<PayMethod>("cash");
  const [classFilter, setClassFilter]     = useState("all");
  const [search, setSearch]               = useState("");
  const [classes, setClasses]             = useState<Class[]>([]);
  const [students, setStudents]           = useState<StudentPaymentInfo[]>([]);
  const [loading, setLoading]             = useState(false);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [payingId, setPayingId]           = useState<string | null>(null);
  const [bulkPaying, setBulkPaying]       = useState(false);
  const [receipt, setReceipt]             = useState<ReceiptData | null>(null);

  const branchId   = currentBranch?.id   ?? "";
  const branchName = currentBranch?.name ?? "";

  // Load classes
  useEffect(() => {
    if (!branchId) return;
    listClasses(branchId).then(setClasses).catch(() => {});
  }, [branchId]);

  // Load unpaid/partial students
  const loadStudents = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await searchStudentsWithPaymentStatus({
        branchId,
        search,
        classId: classFilter !== "all" ? classFilter : undefined,
        limit: 200,
      });
      setStudents(res.data ?? []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, search, classFilter]);

  useEffect(() => {
    if (tab === "collect" || tab === "bulk") loadStudents();
  }, [tab, loadStudents]);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      if (tab === "collect" || tab === "bulk") loadStudents();
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const unpaid = students.filter((s) => s.paymentStatus !== "paid");
  const unpaidSelected = unpaid.filter((s) => selected.has(s.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(unpaid.map((s) => s.id)));
  const clearAll  = () => setSelected(new Set());

  const makeReceipt = (student: StudentPaymentInfo, result: BulkResult): ReceiptData => ({
    studentName:   student.fullName,
    amount:        student.remaining,
    month:         result.payment?.month   ?? "",
    year:          result.payment?.year    ?? new Date().getFullYear(),
    method:        payMethod,
    invoiceNumber: result.payment?.invoiceNumber ?? "",
    branchName,
    paidAt:        new Date().toLocaleString(),
  });

  // Pay a single student (collect mode one-tap)
  const payOne = async (student: StudentPaymentInfo) => {
    setPayingId(student.id);
    try {
      const res = await bulkPay(branchId, payMethod, [{
        studentId: student.id,
        amount: student.remaining,
        paymentMethod: payMethod,
      }]);
      const r = res.results[0]!;
      if (r.error) { notify.error(r.error); return; }
      setReceipt(makeReceipt(student, r));
      setStudents((prev) =>
        prev.map((s) => s.id === student.id ? { ...s, paymentStatus: "paid", amountPaid: s.monthlyPayment, remaining: 0 } : s)
      );
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setPayingId(null);
    }
  };

  // Pay all selected (bulk mode)
  const payBulk = async () => {
    const targets = unpaid.filter((s) => selected.has(s.id));
    if (targets.length === 0) return;
    setBulkPaying(true);
    try {
      const entries: BulkEntry[] = targets.map((s) => ({
        studentId:     s.id,
        amount:        s.remaining,
        paymentMethod: payMethod,
      }));
      const res = await bulkPay(branchId, payMethod, entries);
      notify.warning(t("paymentSuccess"), `${res.succeeded} / ${targets.length} ${t("students").toLowerCase()}`);
      // Update local state
      const paidIds = new Set(res.results.filter((r) => r.payment).map((r) => r.studentId));
      setStudents((prev) =>
        prev.map((s) =>
          paidIds.has(s.id) ? { ...s, paymentStatus: "paid", amountPaid: s.monthlyPayment, remaining: 0 } : s
        )
      );
      setSelected(new Set());
      // Show receipt for first success
      const first = res.results.find((r) => r.payment);
      if (first) {
        const s = targets.find((s) => s.id === first.studentId)!;
        setReceipt(makeReceipt(s, first));
      }
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setBulkPaying(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "collect", label: t("collectMode"), icon: <Zap       className="w-4 h-4" /> },
    { id: "bulk",    label: t("bulkMode"),    icon: <Users      className="w-4 h-4" /> },
    { id: "scan",    label: t("scanMode"),    icon: <QrCode     className="w-4 h-4" /> },
  ];

  const paidCount   = students.filter((s) => s.paymentStatus === "paid").length;
  const unpaidCount = students.length - paidCount;

  return (
    <>
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-indigo-500" />
              {t("quickPayment")}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">{branchName} · {currentMonthLabel()}</p>
          </div>
          {/* Payment method selector */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {PAY_METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setPayMethod(m.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  payMethod === m.id
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                )}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all",
                tab === tb.id
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              {tb.icon} {tb.label}
            </button>
          ))}
        </div>

        {/* Filters row (collect + bulk) */}
        {(tab === "collect" || tab === "bulk") && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t("students") + "..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder={t("classes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("classes")} (all)</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Stats bar (collect + bulk) */}
        {(tab === "collect" || tab === "bulk") && students.length > 0 && (
          <div className="flex gap-3 text-sm">
            <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950 px-3 py-1.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              <span className="font-semibold text-red-700 dark:text-red-300">{unpaidCount} unpaid</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">{paidCount} paid</span>
            </div>
          </div>
        )}

        {/* ── COLLECT tab ── */}
        {tab === "collect" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {loading ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="text-right space-y-1.5">
                      <Skeleton className="h-5 w-20 ml-auto" />
                      <Skeleton className="h-3 w-12 ml-auto" />
                    </div>
                    <Skeleton className="h-9 w-24 rounded-lg flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : students.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-600">{t("allPaid")}</p>
              </div>
            ) : (
              students.map((s) => (
                <StudentCard
                  key={s.id}
                  student={s}
                  selected={selected.has(s.id)}
                  paying={payingId === s.id}
                  onToggle={() => toggleSelect(s.id)}
                  onPayNow={() => payOne(s)}
                  payMethod={payMethod}
                  t={t}
                />
              ))
            )}
          </div>
        )}

        {/* ── BULK tab ── */}
        {tab === "bulk" && (
          <div className="space-y-3">
            {/* Bulk action bar */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={selected.size === unpaid.length ? clearAll : selectAll}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                >
                  {selected.size === unpaid.length ? "Deselect all" : "Select all"}
                </button>
                {selected.size > 0 && (
                  <span className="text-sm text-slate-500">
                    {selected.size} {t("selected")}
                  </span>
                )}
              </div>
              <Button
                disabled={selected.size === 0 || bulkPaying}
                onClick={payBulk}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-sm"
              >
                <Zap className="w-3.5 h-3.5" />
                {bulkPaying ? "..." : `${t("paySelected")} (${unpaidSelected.length})`}
              </Button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {loading ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4">
                      <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <div className="text-right space-y-1.5">
                        <Skeleton className="h-5 w-20 ml-auto" />
                        <Skeleton className="h-3 w-12 ml-auto" />
                      </div>
                      <Skeleton className="h-9 w-24 rounded-lg flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ) : students.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                  <p className="text-sm font-medium text-emerald-600">{t("allPaid")}</p>
                </div>
              ) : (
                students.map((s) => (
                  <StudentCard
                    key={s.id}
                    student={s}
                    selected={selected.has(s.id)}
                    paying={payingId === s.id}
                    onToggle={() => toggleSelect(s.id)}
                    onPayNow={() => payOne(s)}
                    payMethod={payMethod}
                    t={t}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ── SCAN tab ── */}
        {tab === "scan" && (
          <QRScanTab
            branchId={branchId}
            payMethod={payMethod}
            branchName={branchName}
            t={t}
            onPaid={(r) => setReceipt(r)}
          />
        )}
    </div>
    {/* Receipt modal */}
    <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
