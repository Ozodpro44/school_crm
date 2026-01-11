"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout";
import { getAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Plus, Trash2, Edit2, RefreshCw } from "lucide-react";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });
  const { token } = useAuthStore();

  const fetchUsers = async () => {
    if (!token) {
      setError("Not authenticated. Please login first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const api = getAPI();
      const response = await api.get("/api/users");
      setUsers(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError("Not authenticated");
      return;
    }

    try {
      const api = getAPI();
      await api.post("/api/auth/register", formData);

      setFormData({ email: "", password: "", firstName: "", lastName: "" });
      setShowForm(false);
      fetchUsers();
      alert("User created successfully!");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create user");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  if (!token) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white">User Management</h1>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">User Management</h1>
            <p className="text-slate-400 mt-2">
              Create and manage user accounts
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white py-2 px-4 rounded flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New User
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {/* Create User Form */}
        {showForm && (
          <form
            onSubmit={createUser}
            className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4"
          >
            <h3 className="text-lg font-semibold text-white">Create New User</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                required
              />
              <input
                type="text"
                placeholder="First Name"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className="px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-semibold"
              >
                Create User
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Users List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-slate-600 border-t-blue-400 rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400 mt-4">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
            <p className="text-slate-400">No users found</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-700/50">
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-slate-300 font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-700/50">
                    <td className="px-6 py-4 text-white font-mono text-xs">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded text-xs font-semibold">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      <button className="text-blue-400 hover:text-blue-300">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
