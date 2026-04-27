import React, { useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── FilterBar ────────────────────────────────────────────────────────────────
// Uniform container for search + filter controls across all list pages.
// Usage:
//   <FilterBar>
//     <FilterSearch value={q} onChange={setQ} placeholder="Search…" />
//     <Select ...><SelectTrigger className={filterSelect()} ...>
//     <FilterReset onClick={reset} show={isActive} />
//   </FilterBar>

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn(
      "flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs",
      className
    )}>
      {children}
    </div>
  );
}

// ── FilterSearch ─────────────────────────────────────────────────────────────

interface FilterSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;       // called on Enter or search icon click
  placeholder?: string;
  className?: string;
}

export function FilterSearch({
  value,
  onChange,
  onSearch,
  placeholder = "Search…",
  className,
}: FilterSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSearch?.();
    if (e.key === "Escape") { onChange(""); inputRef.current?.blur(); }
  };

  return (
    <div className={cn("relative flex-1 min-w-[180px]", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-9 pl-8 pr-8 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(""); inputRef.current?.focus(); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── FilterReset ───────────────────────────────────────────────────────────────

interface FilterResetProps {
  onClick: () => void;
  show: boolean;
  label?: string;
}

export function FilterReset({ onClick, show, label = "Reset" }: FilterResetProps) {
  if (!show) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-9 gap-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
    >
      <X className="w-3.5 h-3.5" />
      {label}
    </Button>
  );
}

// ── Helper: consistent select trigger height ──────────────────────────────────
// Apply to <SelectTrigger className={filterSelectClass("w-40")}> ...
export function filterSelectClass(width = "w-40") {
  return cn("h-9 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700", width);
}
