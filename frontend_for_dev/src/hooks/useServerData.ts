/**
 * Custom hook for fetching server data
 * Provides loading, error, and data states
 */

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface UseServerDataOptions {
  skip?: boolean;
  refetchInterval?: number;
  onError?: (error: Error) => void;
  onSuccess?: (data: any) => void;
}

export function useServerData<T = any>(
  endpoint: string,
  options: UseServerDataOptions = {}
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
      const response = await (apiClient as any).request<T>(endpoint);
      setData(response);
      setError(null);
      options.onSuccess?.(response);
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
export interface UseMutationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useMutation<T = any>(
  fn: (...args: any[]) => Promise<T>,
  options: UseMutationOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (...args: any[]) => {
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
    (id: string, data: any) => apiClient.updateStudent(id, data),
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
    (id: string, data: any) => apiClient.updatePayment(id, data),
    options
  );
}

/**
 * Hook for deleting a payment
 */
export function useDeletePayment(options?: UseMutationOptions) {
  return useMutation((id: string) => apiClient.deletePayment(id), options);
}
