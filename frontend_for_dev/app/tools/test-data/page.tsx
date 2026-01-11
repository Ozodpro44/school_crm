"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/Layout";
import { getAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Zap, Download } from "lucide-react";

export default function TestDataPage() {
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<string>("");
  const { token } = useAuthStore();

  const generateTestData = async () => {
    if (!token) {
      alert("Please authenticate first");
      return;
    }

    setGenerating(true);
    setResults("");

    try {
      const api = getAPI();
      const response = await api.post("/api/dev/generate-test-data", {});
      
      setResults(
        `Test data generation completed:\n\n${JSON.stringify(response.data, null, 2)}`
      );
    } catch (error: any) {
      setResults(
        `Error generating test data:\n\n${error.response?.data?.error || error.message}`
      );
    } finally {
      setGenerating(false);
    }
  };

  if (!token) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Test Data Generator</h1>
          </div>
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6">
            <p className="text-yellow-300">
              Please authenticate first using the Security Tools.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Test Data Generator</h1>
          <p className="text-slate-400 mt-2">
            Generate dummy data for development and testing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Generator */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
            <h2 className="text-lg font-semibold text-white">Generate Data</h2>

            <button
              onClick={generateTestData}
              disabled={generating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white py-3 px-4 rounded font-semibold flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {generating ? "Generating..." : "Generate Test Data"}
            </button>

            <div className="bg-slate-700 rounded p-4 space-y-3 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Students:</span>
                <span className="font-semibold">50 records</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Teachers:</span>
                <span className="font-semibold">10 records</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Classes:</span>
                <span className="font-semibold">5 records</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Payments:</span>
                <span className="font-semibold">150 records</span>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Results</h2>
              {results && (
                <button className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              )}
            </div>

            {results ? (
              <pre className="bg-slate-700 rounded p-4 text-xs text-slate-300 max-h-64 overflow-auto">
                {results}
              </pre>
            ) : (
              <div className="bg-slate-700 rounded p-8 text-center text-slate-400">
                <p>Click generate to create test data</p>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">What Gets Generated</h2>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li>• Student profiles with contact information</li>
            <li>• Teacher accounts with department assignments</li>
            <li>• Classes with student enrollments</li>
            <li>• Payment records with various statuses</li>
            <li>• Random dates and valid data types</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
