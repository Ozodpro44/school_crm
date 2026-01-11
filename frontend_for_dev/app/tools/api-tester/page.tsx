"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/Layout";
import { getAPI } from "@/lib/api";
import { useAuthStore, useAPIStore } from "@/lib/store";
import { Send, Copy, Trash2, ChevronDown } from "lucide-react";

const COMMON_ENDPOINTS = [
  { method: "GET", path: "/api/students", description: "List all students" },
  { method: "GET", path: "/api/users", description: "List all users" },
  {
    method: "GET",
    path: "/api/classes",
    description: "List all classes",
  },
  {
    method: "GET",
    path: "/api/payments",
    description: "List all payments",
  },
  { method: "GET", path: "/api/settings", description: "Get branch settings" },
  {
    method: "PUT",
    path: "/api/settings",
    description: "Update branch settings",
  },
  { method: "GET", path: "/api/reports", description: "Get reports" },
  { method: "POST", path: "/api/auth/login", description: "Login (public)" },
];

export default function APITesterPage() {
  const [method, setMethod] = useState("GET");
  const [endpoint, setEndpoint] = useState("/api/students");
  const [headers, setHeaders] = useState('{"Content-Type": "application/json"}');
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number>(0);
  const { token } = useAuthStore();
  const { logs } = useAPIStore();

  const handleSendRequest = async () => {
    if (!endpoint) {
      alert("Please enter an endpoint");
      return;
    }

    setLoading(true);
    const startTime = performance.now();

    try {
      const api = getAPI();
      const config: any = {
        method,
        url: endpoint,
      };

      if (headers) {
        config.headers = JSON.parse(headers);
      }

      if (body && (method === "POST" || method === "PUT")) {
        config.data = JSON.parse(body);
      }

      const result = await api(config);
      const time = Math.round(performance.now() - startTime);

      setStatusCode(result.status);
      setResponseTime(time);
      setResponse(JSON.stringify(result.data, null, 2));
    } catch (error: any) {
      const time = Math.round(performance.now() - startTime);
      setResponseTime(time);
      setStatusCode(error.response?.status || 500);
      setResponse(
        JSON.stringify(
          error.response?.data || { error: error.message },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold text-white">API Tester</h1>
          <p className="text-slate-400 mt-2">
            Send HTTP requests to test API endpoints
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Request Builder */}
          <div className="lg:col-span-2 space-y-6">
            {/* Auth Status */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-sm text-slate-400 mb-2">Authentication</p>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    token ? "bg-green-500" : "bg-red-500"
                  }`}
                ></div>
                <p className="text-white">
                  {token
                    ? `Authenticated (${token.value.slice(0, 20)}...)`
                    : "Not authenticated"}
                </p>
              </div>
            </div>

            {/* Method & Endpoint */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500 font-mono text-sm"
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>DELETE</option>
                  <option>PATCH</option>
                </select>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="/api/endpoint"
                  className="flex-1 px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
              </div>

              {/* Quick Endpoints */}
              <details className="group">
                <summary className="cursor-pointer text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                  Quick Endpoints
                </summary>
                <div className="mt-2 space-y-1 pl-4">
                  {COMMON_ENDPOINTS.map((ep) => (
                    <button
                      key={ep.path}
                      onClick={() => {
                        setMethod(ep.method);
                        setEndpoint(ep.path);
                      }}
                      className="block w-full text-left text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
                    >
                      <span className="font-mono font-semibold">{ep.method}</span>{" "}
                      {ep.path} - {ep.description}
                    </button>
                  ))}
                </div>
              </details>
            </div>

            {/* Headers */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Headers
              </label>
              <textarea
                value={headers}
                onChange={(e) => setHeaders(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500 font-mono text-sm h-20 resize-none"
              />
            </div>

            {/* Body */}
            {(method === "POST" || method === "PUT" || method === "PATCH") && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Body (JSON)
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder='{"key": "value"}'
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500 font-mono text-sm h-32 resize-none"
                />
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSendRequest}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              {loading ? "Sending..." : "Send Request"}
            </button>
          </div>

          {/* Response */}
          <div className="space-y-3">
            <h3 className="text-white font-semibold">Response</h3>

            {statusCode && (
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Status Code</span>
                  <span
                    className={`font-mono font-bold ${
                      statusCode >= 200 && statusCode < 300
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {statusCode}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Response Time</span>
                  <span className="font-mono text-white">{responseTime}ms</span>
                </div>
              </div>
            )}

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 h-96 overflow-auto">
              <pre className="text-xs text-slate-300 font-mono">
                {response || "No response yet"}
              </pre>
            </div>

            {response && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(response);
                  alert("Response copied to clipboard!");
                }}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Response
              </button>
            )}
          </div>
        </div>

        {/* API Logs */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              Recent API Logs
            </h3>
            {logs.length > 0 && (
              <button
                onClick={() => useAPIStore.getState().clearLogs()}
                className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-auto">
            {logs.length === 0 ? (
              <p className="text-slate-400 text-sm">No API calls logged yet</p>
            ) : (
              logs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="text-xs p-2 bg-slate-700 rounded border border-slate-600 font-mono space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold px-2 py-1 rounded ${
                        log.method === "GET"
                          ? "bg-blue-900 text-blue-200"
                          : log.method === "POST"
                            ? "bg-green-900 text-green-200"
                            : log.method === "PUT"
                              ? "bg-yellow-900 text-yellow-200"
                              : "bg-red-900 text-red-200"
                      }`}
                    >
                      {log.method}
                    </span>
                    <span className="text-slate-300">{log.endpoint}</span>
                    {log.status && (
                      <span
                        className={
                          log.status >= 200 && log.status < 300
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {log.status}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400">
                    {log.responseTime}ms • {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
