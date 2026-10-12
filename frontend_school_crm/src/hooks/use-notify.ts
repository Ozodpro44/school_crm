import { useToast } from "@/hooks/use-toast";

/**
 * useNotify — opinionated, type-safe shorthand for the four standard toast variants.
 *
 * Usage:
 *   const notify = useNotify();
 *   notify.success("Saved", "Your changes have been saved.");
 *   notify.error("Save failed", "Network error — try again.");
 *   notify.warning("Heads up", "Some items were skipped.");
 *   notify.info("Tip", "You can drag rows to reorder.");
 *
 * Compared to calling `toast()` directly, this:
 *   - enforces the variant per call (no more typos like `variant: "succes"`)
 *   - lets pages omit the `description` (it just doesn't render that line)
 *   - guarantees consistent variant + title structure across the app
 */
export function useNotify() {
  const { toast } = useToast();

  return {
    success(title: string, description?: string) {
      toast({ title, description, variant: "success" });
    },
    error(title: string, description?: string) {
      toast({ title, description, variant: "destructive" });
    },
    warning(title: string, description?: string) {
      toast({ title, description, variant: "default" });
    },
    info(title: string, description?: string) {
      toast({ title, description, variant: "default" });
    },
  };
}
