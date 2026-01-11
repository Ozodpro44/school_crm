"use client";

import { DashboardLayout } from "@/components/Layout";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { getAPI } from "@/lib/api";

interface APIEndpoint {
  method: string;
  path: string;
  description: string;
  public: boolean;
  params?: Record<string, string>;
}

const ENDPOINTS = [
  {
    category: "Authentication",
    endpoints: [
      {
        method: "POST",
        path: "/api/auth/login",
        description: "User login",
        public: true,
        body: { email: "string", password: "string" },
        response: { token: "string", user: "object" },
      },
      {
        method: "POST",
        path: "/api/auth/register",
        description: "User registration",
        public: true,
        body: { email: "string", password: "string", firstName: "string" },
        response: { token: "string", user: "object" },
      },
      {
        method: "POST",
        path: "/api/auth/forgot-password",
        description: "Request password reset",
        public: true,
        body: { email: "string" },
        response: { message: "string" },
      },
      {
        method: "POST",
        path: "/api/auth/verify-otp",
        description: "Verify OTP for password reset",
        public: true,
        body: { email: "string", otp: "string" },
        response: { message: "string" },
      },
      {
        method: "POST",
        path: "/api/auth/reset-password",
        description: "Reset password with OTP",
        public: true,
        body: { email: "string", otp: "string", newPassword: "string" },
        response: { message: "string" },
      },
    ],
  },
  {
    category: "Users",
    endpoints: [
      {
        method: "GET",
        path: "/api/users",
        description: "List all users",
        public: false,
        response: { users: "array" },
      },
      {
        method: "GET",
        path: "/api/users/:id",
        description: "Get user by ID",
        public: false,
        response: { id: "string", email: "string", role: "string" },
      },
      {
        method: "PUT",
        path: "/api/users/:id",
        description: "Update user",
        public: false,
        body: { firstName: "string", lastName: "string", email: "string" },
        response: { id: "string", email: "string" },
      },
      {
        method: "DELETE",
        path: "/api/users/:id",
        description: "Delete user",
        public: false,
        response: { message: "string" },
      },
    ],
  },
  {
    category: "Students",
    endpoints: [
      {
        method: "GET",
        path: "/api/students",
        description: "List all students",
        public: false,
        response: { students: "array" },
      },
      {
        method: "POST",
        path: "/api/students",
        description: "Create new student",
        public: false,
        body: { firstName: "string", lastName: "string", email: "string" },
        response: { id: "string", firstName: "string" },
      },
      {
        method: "GET",
        path: "/api/students/:id",
        description: "Get student by ID",
        public: false,
        response: { id: "string", firstName: "string", lastName: "string" },
      },
      {
        method: "PUT",
        path: "/api/students/:id",
        description: "Update student",
        public: false,
        body: { firstName: "string", lastName: "string", email: "string" },
        response: { id: "string", firstName: "string" },
      },
    ],
  },
  {
    category: "Payments",
    endpoints: [
      {
        method: "GET",
        path: "/api/payments",
        description: "List all payments",
        public: false,
        response: { payments: "array" },
      },
      {
        method: "POST",
        path: "/api/payments",
        description: "Create new payment",
        public: false,
        body: { studentId: "string", amount: "number", date: "string" },
        response: { id: "string", amount: "number" },
      },
      {
        method: "PUT",
        path: "/api/payments/:id",
        description: "Update payment",
        public: false,
        body: { amount: "number", status: "string" },
        response: { id: "string", status: "string" },
      },
    ],
  },
  {
    category: "Settings",
    endpoints: [
      {
        method: "GET",
        path: "/api/settings",
        description: "Get branch settings",
        public: false,
        response: {
          name: "string",
          monthlyPayment: "number",
          currency: "string",
        },
      },
      {
        method: "PUT",
        path: "/api/settings",
        description: "Update branch settings",
        public: false,
        body: {
          name: "string",
          monthlyPayment: "number",
          currency: "string",
        },
        response: {
          name: "string",
          monthlyPayment: "number",
          currency: "string",
        },
      },
    ],
  },
];

export default function APIDocsPage() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    ENDPOINTS[0].category
  );
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const api = getAPI();
      const response = await api.get("/api/dev/api-docs");
      setEndpoints(response.data.endpoints || []);
    } catch (error) {
      console.error("Failed to fetch API docs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">API Documentation</h1>
          <p className="text-slate-400 mt-2">
            School CRM API endpoints reference
          </p>
        </div>

        {/* Quick Reference */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Endpoints", value: ENDPOINTS.reduce((sum, cat) => sum + cat.endpoints.length, 0) },
            { label: "Public Endpoints", value: ENDPOINTS.reduce((sum, cat) => sum + cat.endpoints.filter(e => e.public).length, 0) },
            { label: "Protected Endpoints", value: ENDPOINTS.reduce((sum, cat) => sum + cat.endpoints.filter(e => !e.public).length, 0) },
            { label: "Categories", value: ENDPOINTS.length },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700"
            >
              <p className="text-slate-400 text-sm">{stat.label}</p>
              <p className="text-3xl font-bold text-white mt-1">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Endpoints */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400">Total: {endpoints.length > 0 ? endpoints.length : "Loading..."} endpoints</p>
            <button
              onClick={fetchDocs}
              disabled={loading}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {endpoints.length > 0 ? (
            endpoints.map((endpoint, idx) => (
              <EndpointCard key={idx} endpoint={endpoint} />
            ))
          ) : (
            ENDPOINTS.map((category) => (
            <div
              key={category.category}
              className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() =>
                  setExpandedCategory(
                    expandedCategory === category.category
                      ? null
                      : category.category
                  )
                }
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
              >
                <h2 className="text-lg font-semibold text-white">
                  {category.category}
                </h2>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform ${
                    expandedCategory === category.category ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Endpoints List */}
              {expandedCategory === category.category && (
                <div className="border-t border-slate-700 p-6 space-y-6">
                  {category.endpoints.map((endpoint, idx) => (
                    <EndpointCard key={idx} endpoint={endpoint} />
                  ))}
                </div>
              )}
            </div>
          ))
          )}
          </div>
          </div>
          </DashboardLayout>
          );
          }

function EndpointCard({ endpoint }: { endpoint: any }) {
  const [showDetails, setShowDetails] = useState(false);

  const methodColor = {
    GET: "bg-blue-900 text-blue-200",
    POST: "bg-green-900 text-green-200",
    PUT: "bg-yellow-900 text-yellow-200",
    DELETE: "bg-red-900 text-red-200",
  }[endpoint.method];

  return (
    <div className="border border-slate-700 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <span
            className={`${methodColor} px-3 py-1 rounded text-sm font-semibold whitespace-nowrap`}
          >
            {endpoint.method}
          </span>
          <p className="text-white font-mono text-sm flex-1 break-all">
            {endpoint.path}
          </p>
        </div>
        {endpoint.public && (
          <span className="text-xs bg-green-900/30 text-green-300 px-2 py-1 rounded whitespace-nowrap">
            Public
          </span>
        )}
        {!endpoint.public && (
          <span className="text-xs bg-red-900/30 text-red-300 px-2 py-1 rounded whitespace-nowrap">
            Protected
          </span>
        )}
      </div>

      <p className="text-slate-300 text-sm">{endpoint.description}</p>

      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
      >
        {showDetails ? "Hide Details" : "View Details"}
      </button>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-700 space-y-3">
          {endpoint.body && (
            <div>
              <p className="text-slate-400 text-xs font-semibold mb-2">
                REQUEST BODY
              </p>
              <pre className="bg-slate-700 rounded p-2 text-xs text-slate-300 overflow-auto">
                {JSON.stringify(endpoint.body, null, 2)}
              </pre>
            </div>
          )}

          <div>
            <p className="text-slate-400 text-xs font-semibold mb-2">
              RESPONSE
            </p>
            <pre className="bg-slate-700 rounded p-2 text-xs text-slate-300 overflow-auto">
              {JSON.stringify(endpoint.response, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
