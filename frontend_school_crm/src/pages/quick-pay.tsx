import { QuickPayPanel } from "@/components/panels/QuickPayPanel";

// Standalone route kept for direct bookmarks/links; the admin/manager
// sidebar no longer links here — it's reachable as a "Tezkor to'lov" tab
// on /payments instead (see pages/payments.tsx).
export default function QuickPayPage() {
  return <QuickPayPanel />;
}
