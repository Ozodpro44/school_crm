"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/Layout";
import { getAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Database, FileText, RefreshCw } from "lucide-react";

interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
}

interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
}

const TABLES = [
  {
    name: "users",
    description: "User accounts and authentication",
    columns: [
      { name: "id", type: "UUID", nullable: false },
      { name: "email", type: "VARCHAR", nullable: false },
      { name: "password_hash", type: "VARCHAR", nullable: false },
      { name: "first_name", type: "VARCHAR", nullable: true },
      { name: "last_name", type: "VARCHAR", nullable: true },
      { name: "role", type: "ENUM", nullable: false },
      { name: "branch_id", type: "UUID", nullable: true },
      { name: "created_at", type: "TIMESTAMP", nullable: false },
    ],
  },
  {
    name: "students",
    description: "Student information",
    columns: [
      { name: "id", type: "UUID", nullable: false },
      { name: "first_name", type: "VARCHAR", nullable: false },
      { name: "last_name", type: "VARCHAR", nullable: false },
      { name: "email", type: "VARCHAR", nullable: true },
      { name: "phone", type: "VARCHAR", nullable: true },
      { name: "branch_id", type: "UUID", nullable: false },
      { name: "created_at", type: "TIMESTAMP", nullable: false },
    ],
  },
  {
    name: "payments",
    description: "Student payment records",
    columns: [
      { name: "id", type: "UUID", nullable: false },
      { name: "student_id", type: "UUID", nullable: false },
      { name: "amount", type: "DECIMAL(20,2)", nullable: false },
      { name: "status", type: "ENUM", nullable: false },
      { name: "date", type: "TIMESTAMP", nullable: false },
      { name: "created_at", type: "TIMESTAMP", nullable: false },
    ],
  },
  {
    name: "classes",
    description: "Class information",
    columns: [
      { name: "id", type: "UUID", nullable: false },
      { name: "name", type: "VARCHAR", nullable: false },
      { name: "branch_id", type: "UUID", nullable: false },
      { name: "created_at", type: "TIMESTAMP", nullable: false },
    ],
  },
  {
    name: "branches",
    description: "Branch/location information and settings",
    columns: [
      { name: "id", type: "UUID", nullable: false },
      { name: "name", type: "VARCHAR", nullable: false },
      { name: "address", type: "VARCHAR", nullable: true },
      { name: "phone", type: "VARCHAR", nullable: true },
      { name: "monthly_payment", type: "DECIMAL(20,2)", nullable: true },
      { name: "currency", type: "VARCHAR", nullable: true },
      { name: "created_at", type: "TIMESTAMP", nullable: false },
    ],
  },
];

const MIGRATIONS = [
  {
    version: "000001",
    description: "Initial schema setup",
    direction: "up",
  },
  {
    version: "000002",
    description: "Add user roles",
    direction: "up",
  },
  {
    version: "000003",
    description: "Create payments table",
    direction: "up",
  },
  {
    version: "000013",
    description: "Increase DECIMAL precision from (15,2) to (20,2)",
    direction: "up",
  },
];

export default function DBExplorerPage() {
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [migrations, setMigrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuthStore();

  const fetchSchema = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const api = getAPI();
      const [schemaRes, migrationsRes] = await Promise.all([
        api.get("/api/dev/schema"),
        api.get("/api/dev/migrations"),
      ]);
      setTables(schemaRes.data.tables || []);
      setMigrations(migrationsRes.data.migrations || []);
    } catch (error) {
      console.error("Failed to fetch schema:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchema();
  }, [token]);

  const displayTables = tables.length > 0 ? tables : TABLES;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Database Explorer</h1>
            <p className="text-slate-400 mt-2">
              View database schema and migration history
            </p>
          </div>
          <button
            onClick={fetchSchema}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white py-2 px-4 rounded flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Reload
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Total Tables</p>
            <p className="text-3xl font-bold text-white mt-1">{displayTables.length}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Total Columns</p>
            <p className="text-3xl font-bold text-white mt-1">
              {displayTables.reduce((sum, t) => sum + t.columns.length, 0)}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Migrations</p>
            <p className="text-3xl font-bold text-white mt-1">
              {migrations.length}
            </p>
          </div>
        </div>

        {/* Tables */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Database className="w-5 h-5" />
            Database Tables
          </h2>

          {displayTables.map((table) => (
            <div
              key={table.name}
              className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedTable(
                    expandedTable === table.name ? null : table.name
                  )
                }
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
              >
                <div className="text-left">
                  <p className="text-white font-mono font-semibold">
                    {table.name}
                  </p>
                  <p className="text-slate-400 text-sm">{table.description}</p>
                </div>
              </button>

              {expandedTable === table.name && (
                <div className="border-t border-slate-700 p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-2 text-slate-400 font-semibold">
                            Column
                          </th>
                          <th className="text-left py-2 text-slate-400 font-semibold">
                            Type
                          </th>
                          <th className="text-left py-2 text-slate-400 font-semibold">
                            Nullable
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.columns.map((col) => (
                          <tr
                            key={col.name}
                            className="border-b border-slate-700/50"
                          >
                            <td className="py-3 text-white font-mono">
                              {col.name}
                            </td>
                            <td className="py-3 text-slate-300">
                              <span className="bg-slate-700 px-2 py-1 rounded text-xs">
                                {col.type}
                              </span>
                            </td>
                            <td className="py-3">
                              {col.nullable ? (
                                <span className="text-yellow-400">Yes</span>
                              ) : (
                                <span className="text-red-400">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Migrations */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Migrations
          </h2>

          <div className="bg-slate-800 rounded-lg border border-slate-700 divide-y divide-slate-700">
            {migrations.length > 0 ? (
              migrations.map((mig) => (
                <div key={mig.version} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-mono font-semibold">
                      v{mig.version}
                    </p>
                    {mig.time && (
                      <p className="text-slate-400 text-xs">
                        {new Date(mig.time).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    mig.dirty 
                      ? "bg-red-900/30 text-red-300" 
                      : "bg-green-900/30 text-green-300"
                  }`}>
                    {mig.dirty ? "Dirty" : "Applied"}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-6 py-4 text-slate-400">
                No migrations found or not authenticated
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
