import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Activity,
  TrendingUp,
  Clock,
  AlertTriangle,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const requestsData = [
  { time: "00:00", requests: 1200, latency: 45 },
  { time: "02:00", requests: 800, latency: 42 },
  { time: "04:00", requests: 600, latency: 38 },
  { time: "06:00", requests: 900, latency: 41 },
  { time: "08:00", requests: 3500, latency: 52 },
  { time: "10:00", requests: 5200, latency: 58 },
  { time: "12:00", requests: 4800, latency: 55 },
  { time: "14:00", requests: 5500, latency: 62 },
  { time: "16:00", requests: 4200, latency: 48 },
  { time: "18:00", requests: 3800, latency: 45 },
  { time: "20:00", requests: 2800, latency: 43 },
  { time: "22:00", requests: 1800, latency: 40 },
];

const endpointStats = [
  { endpoint: "GET /students", requests: 12500, avgLatency: 45, errorRate: 0.2 },
  { endpoint: "POST /auth/login", requests: 8200, avgLatency: 120, errorRate: 1.5 },
  { endpoint: "GET /payments", requests: 6800, avgLatency: 85, errorRate: 0.8 },
  { endpoint: "POST /enrollments", requests: 4500, avgLatency: 150, errorRate: 0.5 },
  { endpoint: "GET /teachers", requests: 3200, avgLatency: 38, errorRate: 0.1 },
  { endpoint: "POST /notifications", requests: 2800, avgLatency: 200, errorRate: 2.1 },
];

const errorDistribution = [
  { name: "400 Bad Request", value: 45, color: "hsl(38, 92%, 50%)" },
  { name: "401 Unauthorized", value: 25, color: "hsl(0, 72%, 51%)" },
  { name: "404 Not Found", value: 18, color: "hsl(280, 65%, 60%)" },
  { name: "500 Server Error", value: 12, color: "hsl(0, 72%, 40%)" },
];

export default function Analytics() {
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance metrics and API usage statistics
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="flex items-center gap-1 text-xs text-status-healthy">
              <ArrowUpRight className="w-3 h-3" /> 12%
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">45.2K</p>
          <p className="text-sm text-muted-foreground">Requests Today</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-primary" />
            <span className="flex items-center gap-1 text-xs text-status-healthy">
              <ArrowDownRight className="w-3 h-3" /> 8%
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">52ms</p>
          <p className="text-sm text-muted-foreground">Avg. Latency</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-status-warning" />
            <span className="flex items-center gap-1 text-xs text-status-critical">
              <ArrowUpRight className="w-3 h-3" /> 3%
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">0.8%</p>
          <p className="text-sm text-muted-foreground">Error Rate</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-5 h-5 text-status-healthy" />
          </div>
          <p className="text-2xl font-bold text-foreground">99.95%</p>
          <p className="text-sm text-muted-foreground">Uptime</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Requests Over Time */}
        <div className="xl:col-span-2 glass-card rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-4">Requests Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={requestsData}>
                <defs>
                  <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(187, 85%, 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(187, 85%, 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 16%)" />
                <XAxis dataKey="time" stroke="hsl(215, 20%, 55%)" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(215, 20%, 55%)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222, 47%, 10%)",
                    border: "1px solid hsl(222, 47%, 16%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="hsl(187, 85%, 53%)"
                  strokeWidth={2}
                  fill="url(#requestsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Error Distribution */}
        <div className="glass-card rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-4">Error Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={errorDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {errorDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222, 47%, 10%)",
                    border: "1px solid hsl(222, 47%, 16%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {errorDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="text-foreground font-medium">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Endpoint Stats */}
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Top Endpoints</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left py-3 px-4 font-medium">Endpoint</th>
                <th className="text-right py-3 px-4 font-medium">Requests</th>
                <th className="text-right py-3 px-4 font-medium">Avg. Latency</th>
                <th className="text-right py-3 px-4 font-medium">Error Rate</th>
                <th className="text-left py-3 px-4 font-medium w-48">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {endpointStats.map((endpoint) => (
                <tr key={endpoint.endpoint} className="data-table-row border-b border-border last:border-0">
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-foreground">{endpoint.endpoint}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-foreground">{endpoint.requests.toLocaleString()}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={cn(
                      endpoint.avgLatency > 100 && "text-status-warning",
                      endpoint.avgLatency > 150 && "text-status-critical",
                      endpoint.avgLatency <= 100 && "text-status-healthy"
                    )}>
                      {endpoint.avgLatency}ms
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={cn(
                      endpoint.errorRate > 1 && "text-status-warning",
                      endpoint.errorRate > 2 && "text-status-critical",
                      endpoint.errorRate <= 1 && "text-status-healthy"
                    )}>
                      {endpoint.errorRate}%
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(endpoint.requests / 12500) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
