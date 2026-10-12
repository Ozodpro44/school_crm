/**
 * Persists per-page filter state in localStorage so that filters survive
 * navigation away from and back to a page.
 *
 * Key format: "pf_{pageKey}"
 * Month / year are intentionally excluded — they come from branch state.
 */

const PREFIX = "pf_";

export type FilterRecord = Record<string, string | number>;

export function savePageFilters(pageKey: string, filters: FilterRecord): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + pageKey, JSON.stringify(filters));
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

export function loadPageFilters<T extends FilterRecord>(
  pageKey: string,
  defaults: T,
): T {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(PREFIX + pageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<T>;
    // Merge: keep all default keys, override with saved values
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function clearPageFilters(pageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PREFIX + pageKey);
  } catch {}
}

/** Returns true if the URL query object has at least one of the given filter keys */
export function urlHasFilters(
  query: Record<string, string | string[] | undefined>,
  filterKeys: string[],
): boolean {
  return filterKeys.some((k) => query[k] !== undefined && query[k] !== "");
}
