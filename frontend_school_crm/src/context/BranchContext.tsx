"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { listBranches, getAuthToken } from "@/lib/api";
import { Branch } from "@/types";
import { getCurrentUser } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import {
  AuthEvents,
  clearStoredBranchId,
  getStoredBranchId,
  setStoredBranchId,
} from "@/lib/storage";

interface BranchContextType {
  currentBranch: Branch | null;
  branches: Branch[];
  setCurrentBranch: (branch: Branch) => void;
  setCurrentBranchById: (branchId: string) => void;
  isLoading: boolean;
  refreshBranches: () => Promise<void>;
  clearBranches: () => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [currentBranch, setCurrentBranchState] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadBranches = async () => {
    // Don't load branches if not authenticated
    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const user = getCurrentUser();

      // Backend filters by X-User-ID header (injected by api_gateway).
      // No client-side filtering needed — the backend only returns this user's branches.
      const data = await listBranches();
      let filteredBranches = data;

      // Extra client-side guard for manager/branch_admin: only show their branch.
      if (user && (user.role === "manager" || user.role === "branch_admin")) {
        const allowedBranchIds = (user as any).branchIds || [];
        if (allowedBranchIds.length > 0) {
          filteredBranches = data.filter((b: Branch) => allowedBranchIds.includes(b.id));
        } else if (user.branchId) {
          filteredBranches = data.filter((b: Branch) => b.id === user.branchId);
        }
      }

      setBranches(filteredBranches);

      // Pick the branch to surface: persisted choice first, else first available.
      const savedBranchId = getStoredBranchId();
      const savedBranch = savedBranchId
        ? filteredBranches.find((b: Branch) => b.id === savedBranchId)
        : undefined;

      if (savedBranch) {
        setCurrentBranchState(savedBranch);
      } else if (filteredBranches.length > 0) {
        const first = filteredBranches[0]!;
        setCurrentBranchState(first);
        setStoredBranchId(first.id);
      }
    } catch (error) {
      console.error("Failed to load branches:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load.
    loadBranches();

    // Cross-tab: another tab logged in/out or switched branch.
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "auth_token" || e.key === "current_user" || e.key === "selectedBranchId") {
        loadBranches();
      }
    };

    // Same-tab: fired by storage.ts after login/logout/branch-change.
    const handleLogin = () => loadBranches();
    const handleLogout = () => clearBranches();
    const handleAccessDenied = () => loadBranches();

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener(AuthEvents.LOGIN, handleLogin);
    window.addEventListener(AuthEvents.LOGOUT, handleLogout);
    window.addEventListener(AuthEvents.BRANCH_ACCESS_DENIED, handleAccessDenied);

    return () => {
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener(AuthEvents.LOGIN, handleLogin);
      window.removeEventListener(AuthEvents.LOGOUT, handleLogout);
      window.removeEventListener(AuthEvents.BRANCH_ACCESS_DENIED, handleAccessDenied);
    };
  }, []);

  const setCurrentBranch = (branch: Branch) => {
    setCurrentBranchState(branch);
    setStoredBranchId(branch.id);
    // Legacy event name kept for any non-migrated listeners.
    window.dispatchEvent(new CustomEvent("branchChange", { detail: branch.id }));
    // Invalidate all branch-scoped React Query caches so pages refetch automatically.
    queryClient.invalidateQueries();
  };

  const setCurrentBranchById = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    if (branch) {
      setCurrentBranch(branch);
    }
  };

  const refreshBranches = async () => {
    await loadBranches();
  };

  const clearBranches = () => {
    setCurrentBranchState(null);
    setBranches([]);
    clearStoredBranchId();
  };

  return (
    <BranchContext.Provider
      value={{
        currentBranch,
        branches,
        setCurrentBranch,
        setCurrentBranchById,
        isLoading,
        refreshBranches,
        clearBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}

export function getCurrentBranchId(): string | null {
  return getStoredBranchId();
}
