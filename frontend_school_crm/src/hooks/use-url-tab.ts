import { useCallback } from "react";
import { useRouter } from "next/router";

/**
 * Keeps a page's active tab/section in the URL (?tab=...) so a reload, a
 * shared link or the browser's back button lands on the same section.
 * The fallback (first tab) is not written to the URL; unknown values are
 * ignored. Other query params (filters, ids) are preserved.
 */
export function useUrlTab<T extends string>(
  allowed: readonly T[],
  fallback: T,
  key = "tab"
): [T, (value: T) => void] {
  const router = useRouter();
  const raw = router.isReady ? router.query[key] : undefined;
  const value = (
    typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? raw : fallback
  ) as T;

  const setValue = useCallback(
    (next: T) => {
      const query = { ...router.query };
      if (next === fallback) delete query[key];
      else query[key] = next;
      router.replace({ pathname: router.pathname, query }, undefined, {
        shallow: true,
        scroll: false,
      });
    },
    [router, fallback, key]
  );

  return [value, setValue];
}
