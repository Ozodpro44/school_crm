"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/Layout";
import { useAuthStore } from "@/lib/store";
import { getAPI } from "@/lib/api";
import { Copy, Eye, EyeOff, Trash2, Clock } from "lucide-react";

export default function SecurityToolsPage() {
  const { token, setToken, clearToken } = useAuthStore();
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [decodedToken, setDecodedToken] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Decode JWT
  const decodeToken = (jwtToken: string) => {
    try {
      const parts = jwtToken.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT format");

      const decoded = JSON.parse(atob(parts[1]));
      setDecodedToken(decoded);
      return decoded;
    } catch (error) {
      alert("Invalid JWT token");
      return null;
    }
  };

  // Handle token paste
  const handleTokenPaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setTokenInput(value);
    if (value.length > 20) {
      decodeToken(value);
    }
  };

  // Save token
  const handleSaveToken = () => {
    if (!tokenInput) return;
    const decoded = decodeToken(tokenInput);
    if (decoded) {
      setToken({
        value: tokenInput,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
      });
      setTokenInput("");
      alert("Token saved successfully!");
    }
  };

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const api = getAPI();
      const response = await api.post("/api/auth/login", {
        email: loginEmail,
        password: loginPassword,
      });

      const jwtToken = response.data.token;
      const decoded = decodeToken(jwtToken);

      if (decoded) {
        setToken({
          value: jwtToken,
          expiresAt: new Date(decoded.exp * 1000).toISOString(),
        });
        setLoginEmail("");
        setLoginPassword("");
        alert("Login successful!");
      }
    } catch (error: any) {
      setLoginError(
        error.response?.data?.message ||
          error.message ||
          "Login failed"
      );
    } finally {
      setLoginLoading(false);
    }
  };

  // Check token expiry
  const getTokenStatus = () => {
    if (!token) return { status: "none", message: "No token" };
    const expiryTime = new Date(token.expiresAt).getTime();
    const now = Date.now();
    const diff = expiryTime - now;

    if (diff < 0) {
      return { status: "expired", message: "Expired" };
    } else if (diff < 5 * 60 * 1000) {
      return { status: "expiring", message: `Expires in ${Math.round(diff / 60 / 1000)}m` };
    }
    return { status: "valid", message: `Valid until ${new Date(token.expiresAt).toLocaleString()}` };
  };

  const tokenStatus = getTokenStatus();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Security Tools</h1>
          <p className="text-slate-400 mt-2">
            JWT token management and authentication utilities
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Token */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-4">
              Current Token
            </h2>

            {token ? (
              <div className="space-y-4">
                <div className="bg-slate-700 rounded p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-slate-400 text-sm">JWT Token</p>
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="text-slate-400 hover:text-white"
                    >
                      {showToken ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="font-mono text-xs break-all text-slate-300">
                    {showToken
                      ? token.value
                      : token.value.slice(0, 20) + "..."}
                  </p>
                </div>

                <div className="bg-slate-700 rounded p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <p className="text-slate-400 text-sm">Status</p>
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      tokenStatus.status === "valid"
                        ? "text-green-400"
                        : tokenStatus.status === "expiring"
                          ? "text-yellow-400"
                          : "text-red-400"
                    }`}
                  >
                    {tokenStatus.message}
                  </div>
                </div>

                {decodedToken && (
                  <div className="bg-slate-700 rounded p-4 text-xs">
                    <p className="text-slate-400 mb-2">Decoded Claims</p>
                    <pre className="text-slate-300 overflow-auto max-h-48">
                      {JSON.stringify(decodedToken, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(token.value);
                      alert("Token copied!");
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    onClick={() => clearToken()}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded text-sm flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">No token stored</p>
            )}
          </div>

          {/* Quick Login */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-4">
              Quick Login
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {loginError && (
                <div className="bg-red-900/30 border border-red-700 rounded p-3 text-sm text-red-300">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white py-2 px-4 rounded font-semibold transition-colors"
              >
                {loginLoading ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500">
                Demo credentials available in your project documentation
              </p>
            </div>
          </div>
        </div>

        {/* Paste Token */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            Import Token
          </h2>

          <div className="space-y-4">
            <textarea
              value={tokenInput}
              onChange={handleTokenPaste}
              placeholder="Paste JWT token here..."
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500 font-mono text-sm h-24"
            />

            <button
              onClick={handleSaveToken}
              disabled={!tokenInput}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white py-2 px-4 rounded font-semibold transition-colors"
            >
              Save Token
            </button>
          </div>
        </div>

        {/* Token Info */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            JWT Token Format
          </h2>
          <div className="bg-slate-700 rounded p-4 text-xs text-slate-300 space-y-2">
            <p>
              JWT tokens consist of three parts separated by dots:
            </p>
            <p className="font-mono">
              eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2Njc2ZTI1ZDJkZjg5OGY5NjU0ZjZjNzAiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIn0.abc123
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Header (algorithm and type)</li>
              <li>Payload (claims like email, user ID)</li>
              <li>Signature (verification)</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
