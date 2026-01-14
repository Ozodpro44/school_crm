import { useState, useCallback, useEffect } from "react";
import api from "@/lib/api";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

/**
 * Custom hook for making API calls
 * @example
 * const { data, loading, error } = useApi(() => api.getHealth());
 */
export function useApi<T>(
  fetcher: () => Promise<any>,
  options: UseApiOptions = {}
) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const { immediate = true, onSuccess, onError } = options;

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const response = await fetcher();
      if (response.error) {
        setState({ data: null, loading: false, error: response.error });
        onError?.(response.error);
      } else {
        setState({
          data: response.data,
          loading: false,
          error: null,
        });
        onSuccess?.(response.data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setState({ data: null, loading: false, error: errorMessage });
      onError?.(errorMessage);
    }
  }, [fetcher, onSuccess, onError]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, []);

  return {
    ...state,
    execute,
    refetch: execute,
  };
}

/**
 * Hook for polling API endpoints
 */
export function useApiPolling<T>(
  fetcher: () => Promise<any>,
  interval: number = 5000,
  options: UseApiOptions = {}
) {
  const api = useApi<T>(fetcher, { immediate: true, ...options });

  useEffect(() => {
    const timer = setInterval(() => {
      api.refetch();
    }, interval);

    return () => clearInterval(timer);
  }, [api, interval]);

  return api;
}
