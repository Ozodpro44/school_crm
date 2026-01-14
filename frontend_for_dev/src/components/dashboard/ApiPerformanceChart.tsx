import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const data = [
  { time: "00:00", requests: 120, errors: 2, latency: 45 },
  { time: "04:00", requests: 80, errors: 0, latency: 42 },
  { time: "08:00", requests: 350, errors: 5, latency: 52 },
  { time: "12:00", requests: 520, errors: 8, latency: 58 },
  { time: "16:00", requests: 480, errors: 3, latency: 48 },
  { time: "20:00", requests: 320, errors: 1, latency: 44 },
  { time: "Now", requests: 280, errors: 2, latency: 46 },
];

export function ApiPerformanceChart() {
  return (
    <div className="glass-card rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">API Requests (24h)</h2>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Requests</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-status-critical" />
            <span className="text-muted-foreground">Errors</span>
          </div>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(187, 85%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(187, 85%, 53%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="errorsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 16%)" />
            <XAxis 
              dataKey="time" 
              stroke="hsl(215, 20%, 55%)"
              fontSize={11}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(215, 20%, 55%)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(222, 47%, 10%)",
                border: "1px solid hsl(222, 47%, 16%)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(210, 40%, 98%)" }}
            />
            <Area
              type="monotone"
              dataKey="requests"
              stroke="hsl(187, 85%, 53%)"
              strokeWidth={2}
              fill="url(#requestsGradient)"
            />
            <Area
              type="monotone"
              dataKey="errors"
              stroke="hsl(0, 72%, 51%)"
              strokeWidth={2}
              fill="url(#errorsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
