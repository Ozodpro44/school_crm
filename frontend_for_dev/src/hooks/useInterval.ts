import { useEffect, useRef } from "react";

/** Runs `fn` every `ms` while `enabled`, pausing while the tab is hidden. */
export function useInterval(fn: () => void, ms: number, enabled: boolean) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") saved.current();
    }, ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}
