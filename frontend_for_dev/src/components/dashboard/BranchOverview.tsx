import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { apiClient } from "@/services/api-client";

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  monthlyPayment: number;
  adminId: string;
}

export function BranchOverview() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getBranches()
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value || 0);

  return (
    <div className="glass-card rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Branch Overview</h2>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-status-critical">{error}</div>
      ) : branches.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No branches found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left py-3 px-4 font-medium">Branch</th>
                <th className="text-left py-3 px-4 font-medium">Address</th>
                <th className="text-left py-3 px-4 font-medium">Phone</th>
                <th className="text-right py-3 px-4 font-medium">Monthly Payment</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} className="data-table-row border-b border-border last:border-0">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-sm text-foreground">{branch.name}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{branch.address || "—"}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{branch.phone || "—"}</td>
                  <td className="py-3 px-4 text-right text-sm font-medium text-foreground">
                    {formatCurrency(branch.monthlyPayment)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
