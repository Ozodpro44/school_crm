"use client";

import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";

interface MonthYearSelectorProps {
  month: string;
  year: number;
  onChange: (month: string, year: number) => void;
  currentBranchMonth?: string;
  currentBranchYear?: number;
}

export default function MonthYearSelector({
  month,
  year,
  onChange,
  currentBranchMonth,
  currentBranchYear,
}: MonthYearSelectorProps) {
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const monthNames: { [key: string]: string } = {
    "01": t("january"),
    "02": t("february"),
    "03": t("march"),
    "04": t("april"),
    "05": t("may"),
    "06": t("june"),
    "07": t("july"),
    "08": t("august"),
    "09": t("september"),
    "10": t("october"),
    "11": t("november"),
    "12": t("december"),
  };

  const handlePrevMonth = () => {
    const currentMonth = parseInt(month);
    if (currentMonth === 1) {
      onChange("12", year - 1);
    } else {
      onChange(String(currentMonth - 1).padStart(2, "0"), year);
    }
  };

  const handleNextMonth = () => {
    const currentMonth = parseInt(month);
    if (currentMonth === 12) {
      onChange("01", year + 1);
    } else {
      onChange(String(currentMonth + 1).padStart(2, "0"), year);
    }
  };

  const handleGoToCurrent = () => {
    if (currentBranchMonth && currentBranchYear) {
      onChange(currentBranchMonth, currentBranchYear);
    }
  };

  const isCurrentMonth = month === currentBranchMonth && year === currentBranchYear;
  const isPastMonth = currentBranchMonth && currentBranchYear && 
    (year < currentBranchYear || (year === currentBranchYear && parseInt(month) < parseInt(currentBranchMonth)));

  return (
    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-2">
      <Calendar className="w-4 h-4 text-slate-500" />
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevMonth}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="min-w-[140px] text-center">
        <span className={`font-medium ${isPastMonth ? "text-slate-500" : isCurrentMonth ? "text-blue-600 dark:text-blue-400" : ""}`}>
          {monthNames[month]} {year}
        </span>
        {isCurrentMonth && (
          <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
            {t("current")}
          </span>
        )}
        {isPastMonth && (
          <span className="ml-2 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
            {t("archive")}
          </span>
        )}
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNextMonth}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrentMonth && currentBranchMonth && currentBranchYear && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleGoToCurrent}
          className="ml-2 text-xs"
        >
          {t("goToCurrent")}
        </Button>
      )}
    </div>
  );
}
