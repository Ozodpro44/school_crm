import { useState, useEffect, useRef, useCallback } from "react";
import { useUrlTab } from "@/hooks/use-url-tab";
import { useRefetchOnFocus } from "@/hooks/use-refetch-on-focus";
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
import { formatCurrency } from "@/lib/exportUtils";
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
  QrCode,
  Search,
  Printer,
  CreditCard,
  Banknote,
  Building2,
  AlertCircle,
  Camera,
  ChevronLeft,
  ChevronRight,
  History,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "collect" | "scan";
type StatusFilter = "due" | "all" | "paid";
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
  return apiRequest<{ results: BulkResult[] }>(
    "/payments/bulk",
    {
      method: "POST",
      body: JSON.stringify({ branchId, defaultMethod: paymentMethod, entries }),
    }
  );
}

// ─── Utils ────────────────────────────────────────────────────────────────────

/** Escape a value for safe interpolation into an HTML string. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Same money format as the rest of the app (amount + currency word).
const fmtMoney = (n: number) => formatCurrency(n);

function currentMonthLabel() {
  return new Date().toLocaleString("default", { month: "long", year: "numeric" });
}

const PAY_METHODS: { id: PayMethod; labelKey: string; icon: React.ReactNode }[] = [
  { id: "cash",     labelKey: "cash",        icon: <Banknote  className="w-4 h-4" /> },
  { id: "click",    labelKey: "click",       icon: <CreditCard className="w-4 h-4" /> },
  { id: "bank",     labelKey: "bankTransfer", icon: <Building2  className="w-4 h-4" /> },
  { id: "terminal", labelKey: "terminal",    icon: <CreditCard className="w-4 h-4" /> },
];

// ─── Receipt modal ────────────────────────────────────────────────────────────

function ReceiptModal({ data, onClose }: { data: ReceiptData | null; onClose: () => void }) {
  const language = useLanguage();
  const t = (k: string) => getTranslation(k, language);
  if (!data) return null;

  const print = () => {
    const win = window.open("", "_blank", "width=360,height=520");
    if (!win) return;
    win.document.write(`
      <html><head><title>${esc(t("receiptTitle"))}</title>
      <style>
        body { font-family: monospace; font-size: 13px; padding: 16px; max-width: 300px; margin: 0 auto; }
        h2 { text-align: center; font-size: 15px; margin-bottom: 8px; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
        .bold { font-weight: bold; }
        .center { text-align: center; }
        .big { font-size: 18px; font-weight: bold; text-align: center; margin: 8px 0; }
      </style></head><body>
      <h2>${esc(data.branchName)}</h2>
      <hr/>
      <div class="row"><span>${esc(t("receiptStudent"))}:</span><span class="bold">${esc(data.studentName)}</span></div>
      <div class="row"><span>${esc(t("receiptPeriod"))}:</span><span>${esc(data.month)} ${esc(data.year)}</span></div>
      <div class="row"><span>${esc(t("receiptMethod"))}:</span><span>${esc(data.method)}</span></div>
      <div class="row"><span>${esc(t("receiptInvoice"))}:</span><span>${esc(data.invoiceNumber)}</span></div>
      <div class="row"><span>${esc(t("receiptDate"))}:</span><span>${esc(data.paidAt)}</span></div>
      <hr/>
      <div class="big">${esc(fmtMoney(data.amount))}</div>
      <hr/>
      <div class="center" style="font-size:11px;color:#666;">${esc(t("receiptThankYou"))}</div>
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
            {t("receiptTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 font-mono text-sm space-y-2">
          <div className="text-center font-bold text-base mb-1">{data.branchName}</div>
          <hr className="border-dashed border-slate-300 dark:border-slate-600" />
          <div className="flex justify-between"><span className="text-slate-500">{t("receiptStudent")}</span><span className="font-semibold">{data.studentName}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">{t("receiptPeriod")}</span><span>{data.month} {data.year}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">{t("receiptMethod")}</span><span>{data.method}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">{t("receiptInvoice")}</span><span>{data.invoiceNumber}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">{t("receiptDate")}</span><span>{data.paidAt}</span></div>
          <hr className="border-dashed border-slate-300 dark:border-slate-600" />
          <div className="text-center text-2xl font-bold text-emerald-600">{fmtMoney(data.amount)}</div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>{t("close")}</Button>
          <Button className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={print}>
            <Printer className="w-4 h-4" /> {t("print")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ─── Student row (desktop table row) ──────────────────────────────────────────

// One grid template shared by the header and every row keeps columns aligned.
const ROW_GRID = "grid grid-cols-[28px_minmax(0,1fr)_100px_175px_120px] items-center gap-3 px-4";

function StudentRow({
  student,
  className,
  selected,
  active,
  paying,
  onToggle,
  onPayNow,
  t,
}: {
  student: StudentPaymentInfo;
  className: string;
  selected: boolean;
  active: boolean;
  paying: boolean;
  onToggle: () => void;
  onPayNow: () => void;
  t: (k: string) => string;
}) {
  const isPaid = student.paymentStatus === "paid";
  const isPartial = student.paymentStatus === "partial";

  return (
    <div
      data-active={active || undefined}
      className={cn(
        ROW_GRID,
        "py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0 transition-colors",
        isPaid && "bg-emerald-50/50 dark:bg-emerald-950/10",
        selected && !isPaid && "bg-indigo-50 dark:bg-indigo-950/30",
        active && "bg-indigo-100/70 dark:bg-indigo-500/15 ring-2 ring-inset ring-indigo-500 shadow-[inset_4px_0_0_0_theme(colors.indigo.500)]",
        !isPaid && !active && !selected && "hover:bg-slate-50 dark:hover:bg-slate-800/50"
      )}
    >
      {isPaid ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      ) : (
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={student.fullName} />
      )}

      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            isPaid ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-white"
          )}
          title={student.fullName}
        >
          {student.fullName}
        </p>
        {student.phone && <p className="text-xs text-slate-400 truncate">{student.phone}</p>}
      </div>

      <span className="text-sm text-slate-500 dark:text-slate-400 truncate" title={className}>
        {className}
      </span>

      <div className="text-right tabular-nums">
        {isPaid ? (
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {fmtMoney(student.monthlyPayment)}
          </span>
        ) : (
          <>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {fmtMoney(student.remaining)}
            </span>
            {isPartial && (
              <span className="block text-xs text-amber-500">
                {t("paid")}: {fmtMoney(student.amountPaid)}
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end">
        {isPaid ? (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-0 text-xs">
            {t("paid")}
          </Badge>
        ) : (
          <Button
            size="sm"
            disabled={paying}
            onClick={onPayNow}
            className="h-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
          >
            {paying ? "..." : t("qpPay")}
            {active && !paying && <kbd className="text-[10px] opacity-80">↵</kbd>}
          </Button>
        )}
      </div>
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
      setError(t("cameraPermissionDenied"));
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
      const res = await searchStudentsWithPaymentStatus({ branchId, search: studentId, status: "active", limit: 20 });
      // Exact id match only: never fall back to an unrelated search hit.
      const found = res.data.find((s) => s.id === studentId) ?? null;
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
      if (r.error) { notify.error(t("paymentFailed"), r.error); return; }
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
      notify.error(t("paymentFailed"), e.message);
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
            <button onClick={stopCamera} aria-label={t("close")} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70">
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
        <Button variant="outline" aria-label={t("search")} onClick={handleManual} className="flex-shrink-0">
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 text-red-500 text-sm bg-red-50 dark:bg-red-950 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={startCamera}
            className="text-xs font-semibold text-red-600 hover:text-red-700 underline underline-offset-2 flex-shrink-0"
          >
            {t("tryAgain")}
          </button>
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
            <button onClick={() => setStudent(null)} aria-label={t("clear")} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-0.5">{t("remaining")}</p>
              <p className="font-bold text-lg text-slate-900 dark:text-white">{fmtMoney(student.remaining)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-0.5">{t("amountPaid")}</p>
              <p className="font-bold text-lg text-emerald-600">{fmtMoney(student.amountPaid)}</p>
            </div>
          </div>
          {student.paymentStatus === "paid" ? (
            <Badge className="w-full justify-center py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0">
              <CheckCircle2 className="w-4 h-4 mr-2" /> {t("paid")}
            </Badge>
          ) : (
            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={paying}
              onClick={handlePay}
            >
              <Zap className="w-4 h-4" />
              {paying ? "..." : `${t("markAsPaid")} — ${fmtMoney(student.remaining)}`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Main panel ───────────────────────────────────────────────────────────────

// Extracted from the former standalone /quick-pay page so it can be embedded
// as a tab inside the Payments page (payments.tsx) — content only, no
// page-level <h1> header since the host page already renders one.
//
// Built for a cashier at a desktop: the search box keeps focus, ↑/↓ pick a row,
// Enter takes the payment, and the right-hand column shows what has been
// collected this session (with receipt reprint) so no modal blocks the next
// payment. The list is paged server-side (the branch can have far more
// students than one screen or one request).
const PAGE_SIZES = [25, 50, 100, 200] as const;
const SEARCH_DEBOUNCE_MS = 250;

interface RecentPayment {
  key: string;
  receipt: ReceiptData;
  time: string;
}

function readStored<T extends string | number>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    const v = (typeof fallback === "number" ? Number(raw) : raw) as T;
    return allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string | number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* private mode: preference simply isn't remembered */
  }
}

export function QuickPayPanel({ showHeader = true }: { showHeader?: boolean }) {
  const language = useLanguage();
  const notify = useNotify();
  const t = (k: string) => getTranslation(k, language);
  const { currentBranch } = useBranch();

  const [tab, setTab] = useUrlTab(["collect", "scan"] as const, "collect", "qp");
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("due");
  const [classFilter, setClassFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [autoReceipt, setAutoReceipt] = useState(false);

  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<StudentPaymentInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ paid: 0, partial: 0, notPaid: 0 });
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [selected, setSelected] = useState<Map<string, StudentPaymentInfo>>(new Map());
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
  const [bulkPaying, setBulkPaying] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [recent, setRecent] = useState<RecentPayment[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  const branchId = currentBranch?.id ?? "";
  const branchName = currentBranch?.name ?? "";

  // Remembered preferences (client only, after hydration).
  useEffect(() => {
    setPayMethod(readStored("qp_method", ["cash", "click", "bank", "terminal"] as const, "cash"));
    setPageSize(readStored("qp_page_size", PAGE_SIZES, 50));
    setAutoReceipt(readStored("qp_auto_receipt", ["0", "1"] as const, "0") === "1");
  }, []);

  useEffect(() => {
    if (!branchId) return;
    listClasses(branchId).then(setClasses).catch(() => {});
  }, [branchId]);

  const classNames = new Map(classes.map((c) => [c.id, c.name]));

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  // Any filter change starts again from page 1.
  useEffect(() => {
    setPage(1);
    setActiveIndex(0);
  }, [debouncedSearch, classFilter, statusFilter, pageSize, branchId]);

  const loadStudents = useCallback(async () => {
    if (!branchId) return;
    const reqId = ++requestRef.current;
    setLoading(true);
    try {
      const res = await searchStudentsWithPaymentStatus({
        branchId,
        search: debouncedSearch,
        classId: classFilter !== "all" ? classFilter : undefined,
        status: "active", // only active students can receive payments
        paymentStatus: statusFilter === "all" ? undefined : statusFilter,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      if (reqId !== requestRef.current) return; // a newer request superseded this one
      const data = res.data ?? [];
      // The last row of the last page was just paid: step back instead of showing an empty page.
      if (data.length === 0 && page > 1 && res.total > 0) {
        setPage((p) => Math.max(1, p - 1));
        return;
      }
      setStudents(data);
      setTotal(res.total ?? data.length);
      if (res.counts) setCounts(res.counts);
      // Keep the keyboard cursor where it was (just clamp it) — resetting on every
      // refetch made ↑↓ appear to do nothing whenever a reload landed mid-navigation.
      setActiveIndex((i) => Math.min(i, Math.max(data.length - 1, 0)));
    } catch {
      if (reqId !== requestRef.current) return;
      setStudents([]);
      setTotal(0);
    } finally {
      if (reqId === requestRef.current) setLoading(false);
    }
  }, [branchId, debouncedSearch, classFilter, statusFilter, pageSize, page]);

  useEffect(() => {
    if (tab === "collect") loadStudents();
  }, [tab, loadStudents]);

  // Re-fetch when the page regains visibility (e.g. a payment was deleted elsewhere)
  useRefetchOnFocus(loadStudents);

  // Keyboard-first: the search box is ready as soon as the list is shown.
  useEffect(() => {
    if (tab === "collect") searchRef.current?.focus();
  }, [tab]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, total);
  const payable = students.filter((s) => s.paymentStatus !== "paid");
  const allPageSelected = payable.length > 0 && payable.every((s) => selected.has(s.id));
  const selectedList = Array.from(selected.values());
  const selectedSum = selectedList.reduce((sum, s) => sum + s.remaining, 0);

  const toggleSelect = (s: StudentPaymentInfo) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(s.id)) next.delete(s.id);
      else next.set(s.id, s);
      return next;
    });
  };
  const togglePage = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allPageSelected) payable.forEach((s) => next.delete(s.id));
      else payable.forEach((s) => next.set(s.id, s));
      return next;
    });
  };

  const makeReceipt = (student: StudentPaymentInfo, result: BulkResult): ReceiptData => ({
    studentName: student.fullName,
    amount: student.remaining,
    month: result.payment?.month ?? "",
    year: result.payment?.year ?? new Date().getFullYear(),
    method: payMethod,
    invoiceNumber: result.payment?.invoiceNumber ?? "",
    branchName,
    paidAt: new Date().toLocaleString(),
  });

  const recordPaid = (student: StudentPaymentInfo, result: BulkResult) => {
    const r = makeReceipt(student, result);
    setRecent((prev) =>
      [{ key: result.payment?.id ?? `${student.id}-${Date.now()}`, receipt: r, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 15)
    );
    setSessionTotal((sum) => sum + student.remaining);
    return r;
  };

  const afterPayment = () => {
    // Ready for the next student: clear the query and put the cursor back.
    setSearch("");
    setDebouncedSearch("");
    searchRef.current?.focus();
  };

  const payOne = async (student: StudentPaymentInfo) => {
    if (payingIds.has(student.id) || student.paymentStatus === "paid" || student.remaining <= 0) return;
    setPayingIds((prev) => new Set(prev).add(student.id));
    try {
      const res = await bulkPay(branchId, payMethod, [
        { studentId: student.id, amount: student.remaining, paymentMethod: payMethod },
      ]);
      const r = res.results[0]!;
      if (r.error) {
        notify.error(t("paymentFailed"), r.error);
        return;
      }
      const rc = recordPaid(student, r);
      notify.success(student.fullName, `${fmtMoney(student.remaining)}`);
      if (autoReceipt) setReceipt(rc);
      setSelected((prev) => {
        if (!prev.has(student.id)) return prev;
        const next = new Map(prev);
        next.delete(student.id);
        return next;
      });
      afterPayment();
      // Re-fetch from server — never trust stale local state for payment status
      await loadStudents();
    } catch (e: any) {
      notify.error(t("paymentFailed"), e.message);
    } finally {
      setPayingIds((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
    }
  };

  const payBulk = async () => {
    const targets = selectedList.filter((s) => s.remaining > 0);
    if (targets.length === 0) return;
    setBulkPaying(true);
    try {
      const entries: BulkEntry[] = targets.map((s) => ({
        studentId: s.id,
        amount: s.remaining,
        paymentMethod: payMethod,
      }));
      const res = await bulkPay(branchId, payMethod, entries);
      const results = res.results ?? [];
      const failedRows = results.filter((r) => r.error || !r.payment);
      const okRows = results.filter((r) => r.payment && !r.error);
      okRows.forEach((r) => {
        const s = targets.find((x) => x.id === r.studentId);
        if (s) recordPaid(s, r);
      });
      const summary = `${okRows.length} / ${targets.length} ${t("students").toLowerCase()}`;
      if (failedRows.length === 0) notify.success(t("paymentSuccess"), summary);
      else if (okRows.length === 0) notify.error(t("paymentFailed"), failedRows[0]?.error ?? summary);
      else notify.warning(t("paymentPartial"), `${summary}. ${failedRows[0]?.error ?? ""}`.trim());
      // Keep failed rows selected so they can be retried
      setSelected((prev) => {
        const next = new Map<string, StudentPaymentInfo>();
        failedRows.forEach((r) => {
          const s = prev.get(r.studentId);
          if (s) next.set(s.id, s);
        });
        return next;
      });
      afterPayment();
      await loadStudents();
    } catch (e: any) {
      notify.error(t("paymentFailed"), e.message);
    } finally {
      setBulkPaying(false);
    }
  };

  // Keyboard shortcuts work from anywhere on the page (not only while the search
  // box has focus), except inside other fields, menus and dialogs. The handler
  // reads the latest state through a ref so one listener serves every render.
  const keyStateRef = useRef({ students, activeIndex, receiptOpen: false, payOne });
  keyStateRef.current = { students, activeIndex, receiptOpen: receipt !== null, payOne };

  useEffect(() => {
    if (tab !== "collect") return;
    const onKey = (e: KeyboardEvent) => {
      const st = keyStateRef.current;
      if (st.receiptOpen || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const isSearch = el === searchRef.current;
      if (
        (tag === "INPUT" && !isSearch) ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable ||
        el?.closest('[role="dialog"],[role="listbox"],[role="menu"],[role="combobox"]')
      ) {
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(st.students.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        if (tag === "BUTTON") return; // a focused button handles Enter itself
        const target = st.students[st.activeIndex];
        if (target) {
          e.preventDefault();
          st.payOne(target);
        }
      } else if (e.key === "Escape") {
        setSearch("");
        searchRef.current?.focus();
      } else if (e.key === "/" && !isSearch) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab]);

  // Keep the highlighted row visible while arrowing through a long page.
  useEffect(() => {
    document.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, students]);

  const methodButtons = (
    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
      {PAY_METHODS.map((m) => (
        <button
          key={m.id}
          onClick={() => {
            setPayMethod(m.id);
            writeStored("qp_method", m.id);
            searchRef.current?.focus();
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            payMethod === m.id
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
          )}
        >
          {m.icon} {t(m.labelKey)}
        </button>
      ))}
    </div>
  );

  const statusChips: { id: StatusFilter; label: string; count: number; tone: string }[] = [
    { id: "due", label: t("qpDue"), count: counts.notPaid + counts.partial, tone: "red" },
    { id: "paid", label: t("paid"), count: counts.paid, tone: "emerald" },
    { id: "all", label: t("qpAll"), count: counts.notPaid + counts.partial + counts.paid, tone: "slate" },
  ];

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "collect", label: t("collectMode"), icon: <Zap className="w-4 h-4" /> },
    { id: "scan", label: t("scanMode"), icon: <QrCode className="w-4 h-4" /> },
  ];

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {showHeader ? (
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-indigo-500" />
                {t("quickPayment")}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">{branchName} · {currentMonthLabel()}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">{branchName} · {currentMonthLabel()}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
              {tabs.map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setTab(tb.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    tab === tb.id
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  )}
                >
                  {tb.icon} {tb.label}
                </button>
              ))}
            </div>
            {methodButtons}
          </div>
        </div>

        {tab === "collect" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
            {/* ── List ── */}
            <div className="space-y-3 min-w-0">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    ref={searchRef}
                    autoFocus
                    placeholder={t("qpSearchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-44 h-10 text-sm">
                    <SelectValue placeholder={t("classes")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allClasses") || t("classes")}</SelectItem>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  {statusChips.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setStatusFilter(c.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                        statusFilter === c.id
                          ? c.tone === "red"
                            ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-300"
                            : c.tone === "emerald"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-300"
                            : "bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                          : "border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      {c.label} <span className="tabular-nums opacity-80">{c.count}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 hidden md:block">{t("qpShortcutHint")}</p>
              </div>

              {/* Bulk bar */}
              {selectedList.length > 0 && (
                <div className="flex items-center justify-between gap-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-xl px-4 py-2.5">
                  <div className="text-sm text-indigo-900 dark:text-indigo-200">
                    <span className="font-semibold">{selectedList.length}</span> {t("selected")} ·{" "}
                    <span className="font-semibold tabular-nums">{fmtMoney(selectedSum)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())}>
                      {t("clear")}
                    </Button>
                    <Button
                      size="sm"
                      disabled={bulkPaying}
                      onClick={payBulk}
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {bulkPaying ? "..." : `${t("paySelected")} (${selectedList.length})`}
                    </Button>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Column header */}
                <div
                  className={cn(
                    ROW_GRID,
                    "py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs font-medium uppercase tracking-wide text-slate-500"
                  )}
                >
                  <Checkbox
                    checked={allPageSelected}
                    disabled={payable.length === 0}
                    onCheckedChange={togglePage}
                    aria-label={t("selectAll")}
                  />
                  <span>{t("fullName")}</span>
                  <span>{t("class")}</span>
                  <span className="text-right">{t("remaining")}</span>
                  <span />
                </div>

                <div className="max-h-[calc(100vh-24rem)] min-h-[16rem] overflow-y-auto">
                  {loading && students.length === 0 ? (
                    [1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className={cn(ROW_GRID, "py-3 border-b border-slate-100 dark:border-slate-800")}>
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20 ml-auto" />
                        <Skeleton className="h-8 w-full rounded-md" />
                      </div>
                    ))
                  ) : students.length === 0 ? (
                    <div className="py-14 text-center text-slate-400">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                      <p className="text-sm font-medium text-emerald-600">
                        {statusFilter === "due" && !debouncedSearch && classFilter === "all"
                          ? t("allPaid")
                          : t("qpNothingFound")}
                      </p>
                    </div>
                  ) : (
                    <div className={cn(loading && "opacity-60 transition-opacity")}>
                      {students.map((s, i) => (
                        <StudentRow
                          key={s.id}
                          student={s}
                          className={classNames.get(s.classId) ?? ""}
                          selected={selected.has(s.id)}
                          active={i === activeIndex}
                          paying={payingIds.has(s.id)}
                          onToggle={() => toggleSelect(s)}
                          onPayNow={() => payOne(s)}
                          t={t}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagination */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-sm">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span>{t("qpRowsPerPage")}</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        setPageSize(Number(v));
                        writeStored("qp_page_size", v);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[76px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 tabular-nums">
                      {rangeFrom}–{rangeTo} / {total}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t("qpPrev")}
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="tabular-nums text-slate-600 dark:text-slate-300 min-w-[3.5rem] text-center">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t("qpNext")}
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Session column ── */}
            <aside className="space-y-3 lg:sticky lg:top-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">{t("qpSessionTotal")}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">
                  {fmtMoney(sessionTotal)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{recent.length} {t("qpPaymentsCount")}</p>
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                  <Checkbox
                    checked={autoReceipt}
                    onCheckedChange={(v) => {
                      setAutoReceipt(v === true);
                      writeStored("qp_auto_receipt", v === true ? "1" : "0");
                    }}
                  />
                  {t("qpAutoReceipt")}
                </label>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <History className="w-4 h-4 text-slate-400" /> {t("qpRecent")}
                </div>
                {recent.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-slate-400">{t("qpRecentEmpty")}</p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {recent.map((r) => (
                      <li key={r.key} className="flex items-center gap-2 px-4 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate text-slate-800 dark:text-slate-100">{r.receipt.studentName}</p>
                          <p className="text-xs text-slate-400 tabular-nums">{r.time} · {fmtMoney(r.receipt.amount)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          aria-label={t("print")}
                          title={t("print")}
                          onClick={() => setReceipt(r.receipt)}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        )}

        {tab === "scan" && (
          <div className="max-w-xl mx-auto">
            <QRScanTab
              branchId={branchId}
              payMethod={payMethod}
              branchName={branchName}
              t={t}
              onPaid={(r) => setReceipt(r)}
            />
          </div>
        )}
      </div>
      <ReceiptModal data={receipt} onClose={() => { setReceipt(null); searchRef.current?.focus(); }} />
    </>
  );
}
