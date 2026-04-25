/**
 * Shared TanStack Query hooks.
 *
 * Query key conventions:
 *   ["teachers", branchId]          — list of teachers for a branch
 *   ["classes", branchId]           — list of classes for a branch
 *   ["branches"]                    — all branches for the current user
 *   ["branch", id]                  — single branch detail
 *   ["payments", branchId, params]  — paginated payments
 *   ["students", branchId, params]  — consolidated student list
 *   ["salaries", branchId, params]  — salary list
 *   ["expenses", branchId, params]  — expense list
 *   ["settings", branchId]          — branch settings
 *   ["notifications", branchId]     — unread notifications
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
} from "@tanstack/react-query";
import {
  listTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  listClasses,
  createClass,
  updateClass,
  deleteClass,
  listBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
  listSalaries,
  createSalary,
  updateSalary,
  deleteSalary,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getSettings,
  getStudentsConsolidatedData,
  getPaymentsConsolidatedData,
  getNotifications,
  getTeacherPortalData,
  apiRequest,
  Teacher,
  Class,
  type TeacherPortalData,
  type CreateTeacherRequest,
  type CreateClassRequest,
  type CreateBranchRequest,
} from "@/lib/api";
import type { Branch } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Per-domain stale times.
// Tuned by how often each domain mutates in practice.
// ─────────────────────────────────────────────────────────────────────────────
const STALE = {
  /** ~Never changes on its own — only via admin action. */
  REFERENCE: 5 * 60_000,    // teachers, classes, branches
  /** Edited frequently, but a 1-min stale window is acceptable. */
  TRANSACTIONAL: 60_000,    // students, payments, expenses, salaries
  /** Read-heavy dashboards / reports. */
  REPORT: 2 * 60_000,
  /** Notifications / live data — short. */
  LIVE: 30_000,
  /** Settings rarely change. */
  SETTINGS: 10 * 60_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Teachers
// ─────────────────────────────────────────────────────────────────────────────

export function useTeachersQuery(
  branchId: string | null | undefined,
  options?: Partial<UseQueryOptions<Teacher[]>>
) {
  return useQuery<Teacher[]>({
    queryKey: ["teachers", branchId],
    queryFn: () => listTeachers(branchId!),
    enabled: !!branchId,
    staleTime: STALE.REFERENCE,
    ...options,
  });
}

export function useCreateTeacherMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTeacherRequest) => createTeacher(data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["teachers", variables.branchId] });
    },
  });
}

export function useUpdateTeacherMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTeacherRequest> }) =>
      updateTeacher(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
}

export function useDeleteTeacherMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeacher(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Classes
// ─────────────────────────────────────────────────────────────────────────────

export function useClassesQuery(
  branchId: string | null | undefined,
  options?: Partial<UseQueryOptions<Class[]>>
) {
  return useQuery<Class[]>({
    queryKey: ["classes", branchId],
    queryFn: () => listClasses(branchId!),
    enabled: !!branchId,
    staleTime: STALE.REFERENCE,
    ...options,
  });
}

export function useCreateClassMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClassRequest) => createClass(data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["classes", variables.branchId] });
    },
  });
}

export function useUpdateClassMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateClassRequest> }) =>
      updateClass(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useDeleteClassMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId: string }) =>
      deleteClass(id),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["classes", variables.branchId] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────────────────────────────────────

export function useBranchesQuery(options?: Partial<UseQueryOptions<Branch[]>>) {
  return useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: listBranches,
    staleTime: STALE.REFERENCE,
    ...options,
  });
}

export function useBranchQuery(
  id: string | null | undefined,
  options?: Partial<UseQueryOptions<Branch>>
) {
  return useQuery<Branch>({
    queryKey: ["branch", id],
    queryFn: () => getBranch(id!),
    enabled: !!id,
    staleTime: STALE.REFERENCE,
    ...options,
  });
}

export function useCreateBranchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBranchRequest) => createBranch(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
    },
  });
}

export function useUpdateBranchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBranchRequest> }) =>
      updateBranch(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branch", variables.id] });
    },
  });
}

export function useDeleteBranchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Salaries
// ─────────────────────────────────────────────────────────────────────────────

export function useSalariesQuery(
  branchId: string | null | undefined,
  params?: { month?: string; year?: number },
  options?: Partial<UseQueryOptions<any>>
) {
  return useQuery<any>({
    queryKey: ["salaries", branchId, params],
    queryFn: () => listSalaries(branchId!, params?.month, params?.year),
    enabled: !!branchId,
    staleTime: STALE.TRANSACTIONAL,
    ...options,
  });
}

export function useCreateSalaryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => createSalary(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salaries"] });
    },
  });
}

export function useUpdateSalaryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateSalary(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salaries"] });
    },
  });
}

export function useDeleteSalaryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSalary(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salaries"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Expenses
// ─────────────────────────────────────────────────────────────────────────────

export function useExpensesQuery(
  branchId: string | null | undefined,
  params?: { month?: string; year?: number },
  options?: Partial<UseQueryOptions<any>>
) {
  return useQuery<any>({
    queryKey: ["expenses", branchId, params],
    queryFn: () => listExpenses(branchId!, params?.month, params?.year),
    enabled: !!branchId,
    staleTime: STALE.TRANSACTIONAL,
    ...options,
  });
}

export function useCreateExpenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => createExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useUpdateExpenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateExpense(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useDeleteExpenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Students (consolidated)
// ─────────────────────────────────────────────────────────────────────────────

export function useStudentsConsolidatedQuery(
  branchId: string | null | undefined,
  page: number,
  limit: number,
  filters: {
    search?: string;
    classId?: string;
    status?: string;
    paymentStatus?: string;
    month?: string;
    year?: string;
  },
  options?: Partial<UseQueryOptions<any>>
) {
  return useQuery<any>({
    queryKey: ["students", branchId, page, limit, filters],
    queryFn: () => getStudentsConsolidatedData(branchId!, page, limit, filters),
    enabled: !!branchId,
    staleTime: STALE.TRANSACTIONAL,
    placeholderData: (prev: unknown) => prev, // keep previous data visible during refetch
    ...options,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Payments (consolidated)
// ─────────────────────────────────────────────────────────────────────────────

export function usePaymentsConsolidatedQuery(
  branchId: string | null | undefined,
  page: number,
  limit: number,
  filters: {
    search?: string;
    status?: string;
    month?: string;
    year?: string;
    paymentMethod?: string;
    classId?: string;
  },
  options?: Partial<UseQueryOptions<any>>
) {
  return useQuery<any>({
    queryKey: ["payments", branchId, page, limit, filters],
    queryFn: () => getPaymentsConsolidatedData(branchId!, page, limit, filters),
    enabled: !!branchId,
    staleTime: STALE.TRANSACTIONAL,
    placeholderData: (prev: unknown) => prev,
    ...options,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

export function useSettingsQuery(
  branchId: string | null | undefined,
  options?: Partial<UseQueryOptions<any>>
) {
  return useQuery<any>({
    queryKey: ["settings", branchId],
    queryFn: () => getSettings(branchId ?? undefined),
    enabled: !!branchId,
    staleTime: STALE.SETTINGS,
    ...options,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

export function useNotificationsQuery(
  branchId: string | null | undefined,
  options?: Partial<UseQueryOptions<any>>
) {
  return useQuery<any>({
    queryKey: ["notifications", branchId],
    queryFn: () => getNotifications(),
    enabled: !!branchId,
    staleTime: STALE.LIVE,
    refetchInterval: 60_000, // poll every 60 s for new notifications
    ...options,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Portal
// ─────────────────────────────────────────────────────────────────────────────

export function useTeacherPortalQuery(
  options?: Partial<UseQueryOptions<TeacherPortalData>>
) {
  return useQuery<TeacherPortalData>({
    queryKey: ["teacher-portal"],
    queryFn: () => getTeacherPortalData(),
    staleTime: 2 * 60_000, // 2 min — portal data is read-heavy
    ...options,
  });
}

export function useAttendanceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      branchId: string;
      classId: string;
      date: string;
      records: { studentId: string; status: string; note?: string }[];
    }) =>
      apiRequest("/attendance", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      // Invalidate portal so student payment statuses refresh if needed
      qc.invalidateQueries({ queryKey: ["teacher-portal"] });
    },
  });
}
