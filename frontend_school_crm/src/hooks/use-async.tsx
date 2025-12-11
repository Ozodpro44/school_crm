import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";

type RunOptions = {
  showToastOnError?: boolean;
};

export function useAsync() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts?: RunOptions) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fn();
        setIsLoading(false);
        return res as T;
      } catch (err: any) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setIsLoading(false);
        if (opts?.showToastOnError !== false) {
          toast({ title: e.message || "An error occurred" });
        }
        throw err;
      }
    },
    [toast]
  );

  return { isLoading, error, run } as const;
}
