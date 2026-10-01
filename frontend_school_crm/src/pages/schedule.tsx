import { SchedulePanel } from "@/components/panels/SchedulePanel";

// Standalone route — still used directly by the teacher portal nav (no
// Classes page to nest into there). The admin/manager sidebar no longer
// links here; it's reachable as a "Jadval" tab on /classes instead.
export default function SchedulePage() {
  return <SchedulePanel />;
}
