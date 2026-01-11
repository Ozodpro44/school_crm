"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/Layout";
import { getAPI } from "@/lib/api";
import { RefreshCw, Check, X } from "lucide-react";

interface HealthStatus {
  status: string;
  timestamp?: string;
  uptime?: number;
  checks?: Record<string, any>;
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const api = getAPI();
      const response = await api.get("/health");
      setHealth(response.data);
      setLastCheck(new Date());
    } catch (error: any) {
      setHealth({
        status: "error",
        timestamp: new Date().toISOString(),
      });
      setLastCheck(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Auto-check every 30s
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health?.status === "healthy";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">System Health</h1>
            <p className="text-slate-400 mt-2">
              Backend service status and health checks
            </p>
          </div>
          <button
            onClick={checkHealth}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white py-2 px-4 rounded flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">Status</p>
            <div className="flex items-center gap-3">
              {isHealthy ? (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-2xl font-bold text-green-400">Healthy</p>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <p className="text-2xl font-bold text-red-400">Offline</p>
                </>
              )}
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">Last Check</p>
            <p className="text-lg text-white font-mono">
              {lastCheck ? lastCheck.toLocaleTimeString() : "N/A"}
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">API Endpoint</p>
            <p className="text-sm text-white break-all">
              {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}
            </p>
          </div>
        </div>

        {/* Full Response */}
        {health && (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">
              Full Response
            </h2>
            <pre className="bg-slate-700 rounded p-4 text-xs text-slate-300 overflow-auto max-h-96">
              {JSON.stringify(health, null, 2)}
            </pre>
          </div>
        )}

        {/* Endpoints Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { path: "/api/students", method: "GET" },
            { path: "/api/users", method: "GET" },
            { path: "/api/settings", method: "GET" },
            { path: "/api/payments", method: "GET" },
          ].map((endpoint) => (
            <EndpointChecker
              key={endpoint.path}
              {...endpoint}
            />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

function EndpointChecker({
  path,
  method,
}: {
  path: string;
  method: string;
}) {
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    setLoading(true);
    try {
      const api = getAPI();
      const response = await api({ method, url: path });
      setStatus(response.status);
    } catch (error: any) {
      setStatus(error.response?.status || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-center justify-between">
      <div>
        <p className="text-white font-mono text-sm">
          {method} {path}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {status ? (
          <>
            {status >= 200 && status < 300 ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <X className="w-5 h-5 text-red-400" />
            )}
            <span
              className={`font-mono ${
                status >= 200 && status < 300
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {status}
            </span>
          </>
        ) : (
          <div className="w-4 h-4 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin"></div>
        )}
      </div>
    </div>
  );
}
