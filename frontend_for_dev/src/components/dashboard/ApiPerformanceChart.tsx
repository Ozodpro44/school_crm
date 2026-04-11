import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { apiClient } from "@/services/api-client";
import { Loader2 } from "lucide-react";

interface Bucket {
  time: string;
  errors: number;
  warnings: number;
}

type RawLog = { timestamp?: string; level?: string };

function buildBuckets(logs: RawLog[]): Bucket[] {
  const now = new Date();
  // 12 buckets × 2h = 24h
  const buckets: Bucket[] = Array.from({ length: 12 }, (_, i) => {
    const bucketStart = new Date(now.getTime() - (11 - i) * 2 * 60 * 60 * 1000);
    const label = i === 11
      ? "Now"
      : bucketStart.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return { time: label, errors: 0, warnings: 0 };
  });

  for (const log of logs) {
    const ts = new Date(log.timestamp);
    const ageMs = now.getTime() - ts.getTime();
    if (ageMs < 0 || ageMs > 24 * 60 * 60 * 1000) continue;

    const bucketIndex = 11 - Math.floor(ageMs / (2 * 60 * 60 * 1000));
    if (bucketIndex < 0 || bucketIndex > 11) continue;

    const level = (log.level || "").toUpperCase();
    if (level === "ERROR") buckets[bucketIndex].errors++;
    else if (level === "WARN") buckets[bucketIndex].warnings++;
  }

  return buckets;
}

export function ApiPerformanceChart() {
  const [data, setData] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalErrors, setTotalErrors] = useState(0);
  const [totalWarnings, setTotalWarnings] = useState(0);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const logs = await apiClient.getLogs(500);
        const arr: RawLog[] = Array.isArray(logs) ? (logs as RawLog[]) : [];
        const buckets = buildBuckets(arr);
        setData(buckets);
        setTotalErrors(arr.filter((l) => (l.level || "").toUpperCase() === "ERROR").length);
        setTotalWarnings(arr.filter((l) => (l.level || "").toUpperCase() === "WARN").length);
      } catch {
        setData(buildBuckets([]));
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  return (
    <div className="glass-card rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-foreground">API Errors & Warnings (24h)</h2>
          {!loading && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalErrors} errors · {totalWarnings} warnings from logs
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-status-critical" />
            <span className="text-muted-foreground">Errors</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-status-warning" />
            <span className="text-muted-foreground">Warnings</span>
          </div>
        </div>
      </div>
      <div className="h-64">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="errorsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="warningsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
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
                allowDecimals={false}
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
                dataKey="errors"
                stroke="hsl(0, 72%, 51%)"
                strokeWidth={2}
                fill="url(#errorsGradient)"
                name="Errors"
              />
              <Area
                type="monotone"
                dataKey="warnings"
                stroke="hsl(38, 92%, 50%)"
                strokeWidth={2}
                fill="url(#warningsGradient)"
                name="Warnings"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
