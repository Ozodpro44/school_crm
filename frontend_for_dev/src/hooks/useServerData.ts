/**
 * Custom hook for fetching server data
 * Provides loading, error, and data states
 */

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/services/api-client';

export interface UseServerDataOptions<T = unknown> {
  skip?: boolean;
  refetchInterval?: number;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
}

export function useServerData<T = unknown>(
  endpoint: string,
  options: UseServerDataOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (options.skip) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Use a public method route to avoid accessing private request
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'}${endpoint}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('auth_token')
              ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
              : {}),
          },
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData(result);
      setError(null);
      options.onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      options.onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [endpoint, options]);

  useEffect(() => {
    fetchData();

    // Setup refetch interval if specified
    if (options.refetchInterval && options.refetchInterval > 0) {
      const interval = setInterval(fetchData, options.refetchInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, options.refetchInterval]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    isError: error !== null,
    isSuccess: !loading && error === null && data !== null,
  };
}

/**
 * Hook for fetching students
 */
export function useStudents(branchId: string, options?: UseServerDataOptions) {
  return useServerData(
    `/students?branchId=${branchId}`,
    options
  );
}

/**
 * Hook for fetching a single student
 */
export function useStudent(studentId: string, options?: UseServerDataOptions) {
  return useServerData(`/students/${studentId}`, options);
}

/**
 * Hook for fetching payments
 */
export function usePayments(branchId: string, options?: UseServerDataOptions) {
  return useServerData(`/payments?branchId=${branchId}`, options);
}

/**
 * Hook for fetching payment summary
 */
export function usePaymentSummary(branchId: string, options?: UseServerDataOptions) {
  return useServerData(`/payments/branch/${branchId}/summary`, options);
}

/**
 * Hook for fetching branches
 */
export function useBranches(options?: UseServerDataOptions) {
  return useServerData('/branches', options);
}

/**
 * Hook for fetching classes
 */
export function useClasses(branchId: string, options?: UseServerDataOptions) {
  return useServerData(`/classes?branchId=${branchId}`, options);
}

/**
 * Hook for fetching teachers
 */
export function useTeachers(branchId: string, options?: UseServerDataOptions) {
  return useServerData(`/teachers?branchId=${branchId}`, options);
}

/**
 * Hook for mutation operations (POST, PUT, DELETE)
 */
export interface UseMutationOptions<T = unknown> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useMutation<T = unknown>(
  fn: (...args: unknown[]) => Promise<T>,
  options: UseMutationOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (...args: unknown[]) => {
      try {
        setLoading(true);
        setError(null);
        const result = await fn(...args);
        setData(result);
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [fn, options]
  );

  return {
    mutate,
    data,
    loading,
    error,
    isError: error !== null,
    reset: () => {
      setData(null);
      setError(null);
    },
  };
}

/**
 * Hook for creating a student
 */
export function useCreateStudent(options?: UseMutationOptions) {
  return useMutation((data) => apiClient.createStudent(data), options);
}

/**
 * Hook for updating a student
 */
export function useUpdateStudent(options?: UseMutationOptions) {
  return useMutation(
    (id: unknown, data: unknown) => apiClient.updateStudent(id as string, data as Partial<Record<string, unknown>>),
    options
  );
}

/**
 * Hook for deleting a student
 */
export function useDeleteStudent(options?: UseMutationOptions) {
  return useMutation((id: string) => apiClient.deleteStudent(id), options);
}

/**
 * Hook for creating a payment
 */
export function useCreatePayment(options?: UseMutationOptions) {
  return useMutation((data) => apiClient.createPayment(data), options);
}

/**
 * Hook for updating a payment
 */
export function useUpdatePayment(options?: UseMutationOptions) {
  return useMutation(
    (id: unknown, data: unknown) => apiClient.updatePayment(id as string, data as Partial<Record<string, unknown>>),
    options
  );
}

/**
 * Hook for deleting a payment
 */
export function useDeletePayment(options?: UseMutationOptions) {
  return useMutation((id: string) => apiClient.deletePayment(id), options);
}
