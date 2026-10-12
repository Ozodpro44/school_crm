import { useCallback, useEffect, useRef, useState } from "react";

export interface Resource<T> {
  data: T | null;
  error: string | null;
  /** True only while there is nothing to show yet (first load). */
  loading: boolean;
  /** True during any in-flight request, including background refreshes. */
  fetching: boolean;
  reload: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Loads a resource on mount and exposes reload/setData. Background reloads keep
 * the current data on screen (no skeleton flash), and a stale response from an
 * earlier call never overwrites a newer one.
 */
export function useResource<T>(fetcher: () => Promise<T>, fallbackError: string): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const seq = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setFetching(true);
    try {
      const next = await fetcherRef.current();
      if (mine !== seq.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e instanceof Error && e.message ? e.message : fallbackError);
    } finally {
      if (mine === seq.current) setFetching(false);
    }
  }, [fallbackError]);

  useEffect(() => { void reload(); }, [reload]);

  return { data, error, loading: fetching && data === null, fetching, reload, setData };
}
