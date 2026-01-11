"use client";

import { useEffect } from "react";
import Link from "next/link";
import { initializeAPI } from "@/lib/api";
import {
  Code2,
  Database,
  Settings,
  TestTube,
  Shield,
  Users,
  FileText,
  Activity,
} from "lucide-react";

const tools = [
  {
    title: "API Tester",
    description: "Test and debug API endpoints",
    href: "/tools/api-tester",
    icon: Code2,
    color: "from-blue-600 to-blue-400",
  },
  {
    title: "Database Explorer",
    description: "View database schema and migrations",
    href: "/tools/db-explorer",
    icon: Database,
    color: "from-purple-600 to-purple-400",
  },
  {
    title: "Settings Manager",
    description: "Manage branch settings and configuration",
    href: "/tools/settings-manager",
    icon: Settings,
    color: "from-green-600 to-green-400",
  },
  {
    title: "User Management",
    description: "Create and manage test users",
    href: "/tools/user-management",
    icon: Users,
    color: "from-orange-600 to-orange-400",
  },
  {
    title: "Test Data Generator",
    description: "Generate test data for development",
    href: "/tools/test-data",
    icon: TestTube,
    color: "from-red-600 to-red-400",
  },
  {
    title: "API Documentation",
    description: "Browse API endpoints and schemas",
    href: "/tools/api-docs",
    icon: FileText,
    color: "from-indigo-600 to-indigo-400",
  },
  {
    title: "System Health",
    description: "Check backend status and health",
    href: "/tools/health",
    icon: Activity,
    color: "from-cyan-600 to-cyan-400",
  },
  {
    title: "Security Tools",
    description: "JWT tokens, password reset, etc.",
    href: "/tools/security",
    icon: Shield,
    color: "from-pink-600 to-pink-400",
  },
];

export default function Home() {
  useEffect(() => {
    initializeAPI();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            School CRM Developer Dashboard
          </h1>
          <p className="text-lg text-slate-300">
            Tools and utilities for development and testing
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.href} href={tool.href}>
                <div className="group cursor-pointer h-full">
                  <div className="bg-slate-800 rounded-lg p-6 h-full transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:bg-slate-700">
                    <div
                      className={`inline-block p-3 rounded-lg bg-gradient-to-br ${tool.color} mb-4`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {tool.title}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {tool.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Info */}
        <div className="mt-12 bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-400">API Endpoint</p>
              <p className="text-white font-mono text-sm">
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Environment</p>
              <p className="text-white font-mono text-sm">
                {process.env.NEXT_PUBLIC_ENVIRONMENT || "development"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Status</p>
              <p className="text-green-400 font-mono text-sm">Ready</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
