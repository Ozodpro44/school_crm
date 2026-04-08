import { useEffect, useState } from "react";
import { Users, GraduationCap, CreditCard, Building2, Loader2 } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { apiClient } from "@/services/api-client";

interface Stats {
  totalBranches: number;
  totalStudents: number;
  totalTeachers: number;
  totalMonthlyRevenue: number;
}

export function QuickStats() {
  const [stats, setStats] = useState<Stats>({
    totalBranches: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalMonthlyRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [branches, users] = await Promise.allSettled([
          apiClient.getBranches(),
          apiClient.getUsers(),
        ]);

        const branchList = branches.status === "fulfilled" && Array.isArray(branches.value)
          ? branches.value : [];
        const userList = users.status === "fulfilled" && Array.isArray(users.value)
          ? users.value : [];

        const totalMonthlyRevenue = branchList.reduce(
          (sum: number, b: any) => sum + (b.monthlyPayment || 0),
          0
        );

        setStats({
          totalBranches: branchList.length,
          totalStudents: userList.filter((u: any) => u.role === "admin").length,
          totalTeachers: userList.filter((u: any) => u.role === "manager").length,
          totalMonthlyRevenue,
        });
      } catch {
        // keep defaults on error
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const formatRevenue = (value: number) =>
    new Intl.NumberFormat("uz-UZ", {
      style: "currency",
      currency: "UZS",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="metric-card flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="School Owners"
        value={String(stats.totalStudents)}
        icon={GraduationCap}
      />
      <MetricCard
        title="Managers"
        value={String(stats.totalTeachers)}
        icon={Users}
      />
      <MetricCard
        title="Total Branches"
        value={String(stats.totalBranches)}
        icon={Building2}
      />
      <MetricCard
        title="Monthly Revenue"
        value={formatRevenue(stats.totalMonthlyRevenue)}
        icon={CreditCard}
      />
    </div>
  );
}
