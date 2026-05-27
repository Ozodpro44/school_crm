import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { setOnUnauthorized, setToken, clearToken } from "@/services/api-client";

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
  const [token, setTokenState] = useState<string | null>(
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

  const logoutRef = useRef<() => void>(() => {});

  const logout = () => {
    setTokenState(null);
    setUser(null);
    clearToken();
    localStorage.removeItem("user");
  };

  logoutRef.current = logout;

  useEffect(() => {
    setOnUnauthorized(() => {
      logoutRef.current();
      window.location.href = "/login";
    });
  }, []);

  const login = (tok: string, usr: AuthUser) => {
    setTokenState(tok);
    setUser(usr);
    setToken(tok);
    localStorage.setItem("user", JSON.stringify(usr));
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
