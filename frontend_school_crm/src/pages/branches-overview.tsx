import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getBranchesOverview,
  type BranchesOverview,
  type BranchAnalyticsItem,
} from "@/lib/api";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { hasPermission } from "@/lib/auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart2, Trophy, Users, TrendingUp, Building2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const MONTHS = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december",
];

export default function BranchesOverviewPage() {
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const canView = hasPermission("canViewReports");

  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<BranchesOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = parseInt(month);
      const y = parseInt(year);
      if (!m || !y) return;
      const result = await getBranchesOverview(m, y);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  if (!canView) {
    return (
      <div className="p-8 text-center text-slate-500">
        <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>{t("noPermission") || "You do not have permission to view this page."}</p>
      </div>
    );
  }

  const branches: BranchAnalyticsItem[] = data?.branches ?? [];

  const chartData = branches.map((b) => ({
    name: b.branchName,
    revenue: b.revenue,
    students: b.activeStudents,
    collectionRate: Math.round(b.collectionRate),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display text-brand-gradient flex items-center gap-3">
          <BarChart2 className="w-8 h-8 text-indigo-600" />
          {t("branchesOverview") || "Multi-Branch Overview"}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          {t("branchesOverviewDesc") || "Compare revenue, students, and collection rate across all your branches"}
        </p>
      </div>

      {/* Period selector */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                {t("month") || "Month"}
              </span>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => {
                    const val = String(i + 1).padStart(2, "0");
                    return (
                      <SelectItem key={val} value={val}>
                        {t(name)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                {t("year") || "Year"}
              </span>
              <Input
                type="number"
                min="2000"
                max="2099"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-9 w-24 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top-level KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total revenue */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              {t("totalRevenue") || "Total Revenue"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(data?.totalRevenue ?? 0)}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {branches.length} {t("branches") || "branches"}
            </p>
          </CardContent>
        </Card>

        {/* Total students */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {t("totalStudents") || "Total Active Students"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {(data?.totalStudents ?? 0).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top branch */}
        <Card className="border-l-4 border-l-amber-500 col-span-1 sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              {t("topPerformingBranch") || "Top Performing Branch"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-40" />
            ) : data?.topBranchName ? (
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {data.topBranchName}
                </span>
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                  {formatCurrency(
                    branches.find((b) => b.branchId === data.topBranchId)?.revenue ?? 0
                  )}
                </Badge>
              </div>
            ) : (
              <span className="text-slate-400 text-sm">—</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by branch bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            {t("revenueByBranch") || "Revenue by Branch"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <EmptyState icon={Building2} title={t("noDataFound") || "No data found"} description={t("selectPeriodToSeeData") || "Select a period to see revenue data."} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: "11px" }} />
                <YAxis tick={{ fontSize: "11px" }} tickFormatter={(v) => formatCurrency(v)} width={100} />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="revenue"
                  name={t("revenue") || "Revenue"}
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Branch details table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            {t("branchComparison") || "Branch Comparison"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("branch") || "Branch"}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("revenue") || "Revenue"}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("activeStudents") || "Students"}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("teachers") || "Teachers"}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("collectionRate") || "Collection Rate"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : branches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{t("noDataFound") || "No branches found"}</p>
                    </td>
                  </tr>
                ) : (
                  branches.map((branch) => (
                    <tr
                      key={branch.branchId}
                      className={`border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${branch.branchId === data?.topBranchId ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {branch.branchId === data?.topBranchId && (
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {branch.branchName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(branch.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {branch.activeStudents.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {branch.teacherCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${branch.collectionRate >= 80 ? "bg-emerald-500" : branch.collectionRate >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${branch.collectionRate}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${branch.collectionRate >= 80 ? "text-emerald-600 dark:text-emerald-400" : branch.collectionRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400"}`}>
                            {Math.round(branch.collectionRate)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Student count by branch chart */}
      {!loading && chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              {t("studentCountByBranch") || "Active Students by Branch"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: "11px" }} />
                <YAxis tick={{ fontSize: "11px" }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="students"
                  name={t("activeStudents") || "Active Students"}
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="collectionRate"
                  name={t("collectionRate") || "Collection Rate (%)"}
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
