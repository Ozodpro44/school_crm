import { create } from "zustand";

interface Token {
  value: string;
  expiresAt: string;
}

interface AuthState {
  token: Token | null;
  setToken: (token: Token | null) => void;
  clearToken: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  setToken: (token) => set({ token }),
  clearToken: () => set({ token: null }),
  isAuthenticated: () => {
    const state = get();
    if (!state.token) return false;
    return new Date(state.token.expiresAt) > new Date();
  },
}));

interface APIRequestLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status?: number;
  responseTime: number;
  requestBody?: string;
  responseBody?: string;
}

interface APIState {
  logs: APIRequestLog[];
  addLog: (log: APIRequestLog) => void;
  clearLogs: () => void;
  removeLogs: (count: number) => void;
}

export const useAPIStore = create<APIState>((set) => ({
  logs: [],
  addLog: (log) =>
    set((state) => ({
      logs: [log, ...state.logs].slice(0, 100),
    })),
  clearLogs: () => set({ logs: [] }),
  removeLogs: (count) =>
    set((state) => ({
      logs: state.logs.slice(count),
    })),
}));
