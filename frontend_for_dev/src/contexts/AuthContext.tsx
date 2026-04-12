import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { apiClient } from "@/services/api-client";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initialisers read localStorage synchronously on the first render so
  // ProtectedRoute never sees a false `isAuthenticated` and redirects away.
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("auth_token")
  );
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? (JSON.parse(saved) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  // Keep a stable ref so the 401 callback closure never captures a stale logout
  const logoutRef = useRef<() => void>(() => {});

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  logoutRef.current = logout;

  // Register the 401 handler once on mount so every apiClient request
  // automatically clears credentials and redirects to /login when the
  // JWT has expired or is invalid.
  useEffect(() => {
    apiClient.setOnUnauthorized(() => {
      logoutRef.current();
      window.location.href = "/login";
    });
  }, []);

  const login = (token: string, user: AuthUser) => {
    setToken(token);
    setUser(user);
    localStorage.setItem("auth_token", token);
    localStorage.setItem("user", JSON.stringify(user));
    // Sync token into apiClient so requests made immediately after login work
    apiClient.setToken(token);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
