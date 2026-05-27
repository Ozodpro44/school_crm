
import { useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";

interface ChartData {
  label: string;
  income: number;
  expenses: number;
}

interface FinancialChartProps {
  data: ChartData[];
}

export function FinancialChart({ data }: FinancialChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    ctx.clearRect(0, 0, width, height);

    const maxValue = Math.max(
      ...data.flatMap((d) => [d.income, d.expenses])
    );
    const scale = chartHeight / (maxValue * 1.1);

    const barWidth = chartWidth / (data.length * 2.5);
    const spacing = barWidth / 2;

    data.forEach((item, index) => {
      const x = padding + index * (barWidth * 2 + spacing);
      const incomeHeight = item.income * scale;
      const expensesHeight = item.expenses * scale;

      ctx.fillStyle = "#10b981";
      ctx.fillRect(
        x,
        height - padding - incomeHeight,
        barWidth,
        incomeHeight
      );

      ctx.fillStyle = "#ef4444";
      ctx.fillRect(
        x + barWidth + 5,
        height - padding - expensesHeight,
        barWidth,
        expensesHeight
      );

      ctx.fillStyle = "#64748b";
      ctx.font = "11px Inter";
      ctx.textAlign = "center";
      ctx.fillText(
        item.label.substring(0, 3),
        x + barWidth,
        height - padding + 20
      );
    });

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = height - padding - (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px Inter";
      ctx.textAlign = "right";
      ctx.fillText(
        `${Math.round((maxValue / 5) * i)}`,
        padding - 5,
        y + 3
      );
    }
  }, [data]);

  return (
    <div className="w-full h-64 relative">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-sm text-slate-600 dark:text-slate-400">{t("income")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-sm text-slate-600 dark:text-slate-400">{t("expenses")}</span>
        </div>
      </div>
    </div>
  );
}
