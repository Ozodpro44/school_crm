import React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

// ── Column definition ─────────────────────────────────────────────────────────

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  /** Applied to both <th> and <td> */
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
  /** Hidden on small screens, visible from sm: upward */
  hideOnMobile?: boolean;
};

// ── Pagination state ──────────────────────────────────────────────────────────

export type PaginationState = {
  page: number;
  limit: number;
  total: number;
};

// ── Props ─────────────────────────────────────────────────────────────────────

export type DataTableProps<T extends { id: string }> = {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  /** Number of skeleton rows shown while loading (default 5) */
  skeletonRows?: number;

  // Selection
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  areAllSelected?: boolean;
  areSomeSelected?: boolean;
  /** Rendered above the table when ≥1 row is selected */
  bulkActions?: React.ReactNode;

  // Sorting
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;

  // Pagination
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];

  // Empty state
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };

  // Row behaviour
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;

  /**
   * Optional card renderer for mobile.
   * When provided, screens < sm show cards instead of the table.
   */
  renderCard?: (
    row: T,
    isSelected: boolean,
    onToggle: () => void
  ) => React.ReactNode;
};

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({
  colKey,
  sortKey,
  sortDir,
}: {
  colKey: string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
}) {
  if (colKey !== sortKey) {
    return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 text-slate-400" />;
  }
  return sortDir === "asc" ? (
    <ChevronUp className="ml-1 inline h-3.5 w-3.5 text-indigo-500" />
  ) : (
    <ChevronDown className="ml-1 inline h-3.5 w-3.5 text-indigo-500" />
  );
}

// ── Pagination bar ────────────────────────────────────────────────────────────

function TablePagination({
  pagination,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50],
}: {
  pagination: PaginationState;
  onPageChange?: (p: number) => void;
  onLimitChange?: (l: number) => void;
  limitOptions?: number[];
}) {
  const { page, limit, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
      <p className="text-sm text-slate-500 dark:text-slate-400 order-2 sm:order-1">
        {total === 0 ? "No results" : `${from}–${to} of ${total}`}
      </p>

      <div className="flex items-center gap-3 order-1 sm:order-2">
        {/* Rows per page */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">Rows</span>
          <Select
            value={String(limit)}
            onValueChange={(v) => onLimitChange?.(Number(v))}
          >
            <SelectTrigger className="h-8 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {limitOptions.map((l) => (
                <SelectItem key={l} value={String(l)} className="text-xs">
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prev / page info / next */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-slate-600 dark:text-slate-300 px-2 whitespace-nowrap">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── DataTable ─────────────────────────────────────────────────────────────────

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  skeletonRows = 5,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  areAllSelected = false,
  areSomeSelected = false,
  bulkActions,
  sortKey,
  sortDir,
  onSort,
  pagination,
  onPageChange,
  onLimitChange,
  limitOptions,
  emptyIcon,
  emptyTitle = "No results",
  emptyDescription,
  emptyAction,
  onRowClick,
  rowClassName,
  renderCard,
}: DataTableProps<T>) {
  const visibleColumns = columns; // future: column visibility toggle

  // ── Bulk action bar ─────────────────────────────────────────────────────────
  const selectedCount = selectedIds?.size ?? 0;
  const showBulkBar = selectable && selectedCount > 0 && bulkActions;

  return (
    <div className="w-full">
      {/* Bulk actions bar */}
      {showBulkBar && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-lg mb-3">
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-2">{bulkActions}</div>
        </div>
      )}

      {/* ── Mobile card view ─────────────────────────────────────────────────── */}
      {renderCard && (
        <div className="sm:hidden space-y-2">
          {loading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-100 dark:border-slate-800 p-4"
                >
                  <Skeleton className="h-4 w-2/3 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-1" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))
            : data.length === 0
            ? null // empty state handled below, shared with table
            : data.map((row) =>
                renderCard(
                  row,
                  selectedIds?.has(row.id) ?? false,
                  () => onToggleSelect?.(row.id)
                )
              )}
        </div>
      )}

      {/* ── Table (desktop, or always if no renderCard) ───────────────────────── */}
      <div className={cn(renderCard ? "hidden sm:block" : "")}>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900/50">
              {selectable && (
                <TableHead className="w-10 px-4">
                  <Checkbox
                    checked={areAllSelected}
                    data-state={areSomeSelected ? "indeterminate" : undefined}
                    onCheckedChange={onToggleSelectAll}
                  />
                </TableHead>
              )}
              {visibleColumns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400",
                    col.className,
                    col.headerClassName,
                    col.hideOnMobile && "hidden sm:table-cell",
                    col.sortable && onSort && "cursor-pointer select-none"
                  )}
                  onClick={
                    col.sortable && onSort
                      ? () => onSort(col.key)
                      : undefined
                  }
                >
                  {col.header}
                  {col.sortable && onSort && (
                    <SortIcon colKey={col.key} sortKey={sortKey} sortDir={sortDir} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {selectable && (
                    <TableCell className="px-4">
                      <Skeleton className="h-4 w-4 rounded" />
                    </TableCell>
                  )}
                  {visibleColumns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "px-4 py-3",
                        col.hideOnMobile && "hidden sm:table-cell"
                      )}
                    >
                      <Skeleton className="h-4 w-full max-w-[180px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="p-0"
                >
                  {emptyIcon ? (
                    <EmptyState
                      icon={emptyIcon}
                      title={emptyTitle}
                      description={emptyDescription}
                      action={emptyAction}
                    />
                  ) : (
                    <p className="py-16 text-center text-sm text-slate-400">
                      {emptyTitle}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => (
                <TableRow
                  key={row.id}
                  data-state={selectedIds?.has(row.id) ? "selected" : undefined}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    rowClassName?.(row)
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <TableCell
                      className="px-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect?.(row.id);
                      }}
                    >
                      <Checkbox checked={selectedIds?.has(row.id) ?? false} />
                    </TableCell>
                  )}
                  {visibleColumns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "px-4 py-3",
                        col.className,
                        col.cellClassName,
                        col.hideOnMobile && "hidden sm:table-cell"
                      )}
                    >
                      {col.render(row, i)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && !loading && data.length > 0 && (
        <TablePagination
          pagination={pagination}
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
          limitOptions={limitOptions}
        />
      )}
    </div>
  );
}
