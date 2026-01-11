"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout";
import { getAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Save, RefreshCw } from "lucide-react";

interface Settings {
  name: string;
  monthlyPayment: number;
  currency: string;
  updatedDate?: string;
  createdDate?: string;
}

export default function SettingsManagerPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { token } = useAuthStore();

  const fetchSettings = async () => {
    if (!token) {
      setError("Not authenticated. Please login first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const api = getAPI();
      const response = await api.get("/api/settings");
      setSettings(response.data);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to fetch settings"
      );
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError("Not authenticated. Please login first.");
      return;
    }

    if (!settings) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const api = getAPI();
      const response = await api.put("/api/settings", {
        name: settings.name,
        monthlyPayment: settings.monthlyPayment,
        currency: settings.currency,
      });

      setSettings(response.data);
      setSuccess("Settings updated successfully!");

      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  if (!token) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Settings Manager</h1>
            <p className="text-slate-400 mt-2">Manage branch settings</p>
          </div>

          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6">
            <p className="text-yellow-300">
              Please authenticate first using the Security Tools to access
              settings.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Settings Manager</h1>
            <p className="text-slate-400 mt-2">Manage branch settings</p>
          </div>
          <button
            onClick={fetchSettings}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white py-2 px-4 rounded flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Reload
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-green-300">
            {success}
          </div>
        )}

        {loading ? (
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
            <div className="w-8 h-8 border-4 border-slate-600 border-t-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading settings...</p>
          </div>
        ) : settings ? (
          <form onSubmit={saveSettings} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Branch Name */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) =>
                    setSettings({ ...settings, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Monthly Payment */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Monthly Payment
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.monthlyPayment}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      monthlyPayment: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Currency
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) =>
                    setSettings({ ...settings, currency: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                >
                  <option>UZS</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-2">
              <p className="text-slate-400 text-sm">Created Date</p>
              <p className="text-white font-mono">
                {settings.createdDate
                  ? new Date(settings.createdDate).toLocaleString()
                  : "N/A"}
              </p>

              <p className="text-slate-400 text-sm mt-4">Updated Date</p>
              <p className="text-white font-mono">
                {settings.updatedDate
                  ? new Date(settings.updatedDate).toLocaleString()
                  : "N/A"}
              </p>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white font-semibold py-3 px-4 rounded flex items-center justify-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </form>
        ) : (
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
            <p className="text-slate-400">No settings found</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
