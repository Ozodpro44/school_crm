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
        const branches = await apiClient.getBranches();
        const branchList = Array.isArray(branches) ? branches : [];

        const totalMonthlyRevenue = branchList.reduce(
          (sum: number, b: any) => sum + (b.monthlyPayment || 0),
          0
        );

        const [studentsResults, teachersResults] = await Promise.all([
          Promise.allSettled(branchList.map((b: any) => apiClient.getStudents(b.id))),
          Promise.allSettled(branchList.map((b: any) => apiClient.getTeachers(b.id))),
        ]);

        const totalStudents = studentsResults.reduce((sum, result) => {
          if (result.status === "fulfilled" && Array.isArray(result.value)) {
            return sum + result.value.length;
          }
          return sum;
        }, 0);

        const totalTeachers = teachersResults.reduce((sum, result) => {
          if (result.status === "fulfilled" && Array.isArray(result.value)) {
            return sum + result.value.length;
          }
          return sum;
        }, 0);

        setStats({
          totalBranches: branchList.length,
          totalStudents,
          totalTeachers,
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
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
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
        title="Total Students"
        value={String(stats.totalStudents)}
        icon={GraduationCap}
      />
      <MetricCard
        title="Active Teachers"
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
