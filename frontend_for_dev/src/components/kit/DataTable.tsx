import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RowsSkeleton } from "./States";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Hide the column below this breakpoint to keep the table readable on small screens. */
  showFrom?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Allow the cell content to wrap (cells are single-line by default). */
  wrap?: boolean;
}

const SHOW_FROM = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;
const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** The one table. Hairline rows, sticky-feeling header, horizontal scroll on narrow screens. */
export function DataTable<T>({ columns, rows, rowKey, loading, empty, footer, className }: DataTableProps<T>) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      {loading ? (
        <RowsSkeleton />
      ) : rows.length === 0 ? (
        empty
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap px-4 py-2.5 font-medium",
                      ALIGN[c.align ?? "left"],
                      c.showFrom && SHOW_FROM[c.showFrom],
                      c.className,
                    )}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={rowKey(row)} className="transition-colors hover:bg-muted/40">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-4 py-3 align-middle",
                        c.wrap ? "whitespace-normal" : "whitespace-nowrap",
                        ALIGN[c.align ?? "left"],
                        c.showFrom && SHOW_FROM[c.showFrom],
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footer && !loading && rows.length > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">{footer}</div>
      )}
    </div>
  );
}
