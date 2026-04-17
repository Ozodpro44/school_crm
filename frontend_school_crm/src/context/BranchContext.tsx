"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { listBranches, getAuthToken } from "@/lib/api";
import { Branch } from "@/types";
import { getCurrentUser } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";

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
      const data = await listBranches();
      
      // Filter branches based on user role
      const user = getCurrentUser();
      let filteredBranches = data;
      
      if (user && (user.role === "manager" || user.role === "branch_admin")) {
        // Managers and branch_admins can only see their assigned branches
        const allowedBranchIds = (user as any).branchIds || [];
        if (allowedBranchIds.length > 0) {
          filteredBranches = data.filter((b: Branch) => allowedBranchIds.includes(b.id));
        } else if (user.branchId) {
          // Fallback to single branchId if branchIds not available
          filteredBranches = data.filter((b: Branch) => b.id === user.branchId);
        }
      }
      
      setBranches(filteredBranches);
      
      // Restore selected branch from localStorage or use first branch
      const savedBranchId = localStorage.getItem("selectedBranchId");
      if (savedBranchId) {
        const savedBranch = filteredBranches.find((b: Branch) => b.id === savedBranchId);
        if (savedBranch) {
          setCurrentBranchState(savedBranch);
        } else if (filteredBranches.length > 0) {
          const first = filteredBranches[0]!;
          setCurrentBranchState(first);
          localStorage.setItem("selectedBranchId", first.id);
        }
      } else if (filteredBranches.length > 0) {
        const first = filteredBranches[0]!;
        setCurrentBranchState(first);
        localStorage.setItem("selectedBranchId", first.id);
      }
    } catch (error) {
      console.error("Failed to load branches:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Reload branches when user changes (login/logout)
    loadBranches();
    
    // Listen for auth changes from storage (other tabs)
    const handleAuthChange = () => {
      loadBranches();
    };
    
    window.addEventListener("storage", handleAuthChange);
    
    // Also listen for user changes on the same tab
    const checkUserChange = setInterval(() => {
      const currentUser = getCurrentUser();
      const savedUserId = sessionStorage.getItem("lastUserId");
      
      if (currentUser?.id && currentUser.id !== savedUserId) {
        sessionStorage.setItem("lastUserId", currentUser.id);
        loadBranches();
      } else if (!currentUser && savedUserId) {
        sessionStorage.removeItem("lastUserId");
        clearBranches();
      }
    }, 500);
    
    return () => {
      window.removeEventListener("storage", handleAuthChange);
      clearInterval(checkUserChange);
    };
  }, []);

  const setCurrentBranch = (branch: Branch) => {
    setCurrentBranchState(branch);
    localStorage.setItem("selectedBranchId", branch.id);
    // Dispatch event for legacy components that listen to branchChange.
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
    localStorage.removeItem("selectedBranchId");
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
  return localStorage.getItem("selectedBranchId");
}
