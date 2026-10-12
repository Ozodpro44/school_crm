import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient instance.
 * Created once and passed to QueryClientProvider in _app.tsx.
 *
 * Defaults:
 *  - staleTime: 30s  — data stays fresh for 30 s before background refetch
 *  - gcTime:    5 min — cache kept for 5 min after all subscribers unmount
 *  - refetchOnWindowFocus: true  — auto-refresh when user returns to tab
 *  - retry: 1  — retry failed requests once before surfacing the error
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
