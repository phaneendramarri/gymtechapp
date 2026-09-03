import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Pencil,
  MoreHorizontal,
  Loader2,
  type LucideIcon,
} from "lucide-react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/* ============================================================
   Types
   ============================================================ */

export interface DataTableColumn<T> {
  /** Stable id used for sort state. Must be unique within a table. */
  id: string
  /** Column header label. */
  header: React.ReactNode
  /** Cell renderer. */
  cell: (row: T, rowIndex: number) => React.ReactNode
  /** Optional sort accessor; if provided, the header becomes clickable. */
  sortAccessor?: (row: T) => string | number
  /** When true, the cell content is treated as numeric (applies tabular-nums + right-align). */
  numeric?: boolean
  /** When true, disables sort for this column. */
  disableSort?: boolean
  /** Custom class on the `<th>`. */
  headerClassName?: string
  /** Custom class on every `<td>` of this column. */
  cellClassName?: string
  /** Tailwind width class, e.g. `"w-32"`. */
  widthClass?: string
}

export interface DataTableBulkAction<T> {
  id: string
  label: string
  icon?: LucideIcon
  onClick: (rows: T[]) => void | Promise<void>
  destructive?: boolean
  /** Disable the action (e.g. when it doesn't apply to current selection). */
  disabled?: (rows: T[]) => boolean
}

export interface DataTableRowAction<T> {
  id: string
  label: string
  icon?: LucideIcon
  onClick: (row: T) => void
  destructive?: boolean
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  /** Stable key for each row (e.g. `row.id`). */
  rowKey: (row: T) => string
  /** Toolbar slot on the left (e.g. filter chips). */
  toolbarLeft?: React.ReactNode
  /** Toolbar slot on the right (e.g. export button). */
  toolbarRight?: React.ReactNode
  /** Show row-selection checkboxes. */
  selectable?: boolean
  /** Show an actions column with view/edit/more menu per row. */
  rowActions?: DataTableRowAction<T>[]
  /** Default row action that uses the "eye" icon. */
  onView?: (row: T) => void
  /** Default row action that uses the "pencil" icon. */
  onEdit?: (row: T) => void
  /** Optional bulk actions that appear in a footer when ≥1 row selected. */
  bulkActions?: DataTableBulkAction<T>[]
  /** Page size. Defaults to 25. */
  pageSize?: number
  /** Page-size options for the footer selector. */
  pageSizeOptions?: number[]
  /** Initial sort column id + direction. */
  defaultSort?: { id: string; direction: "asc" | "desc" }
  /** Loading state — shows 5 shimmer rows. */
  isLoading?: boolean
  /** Empty state. */
  emptyState?: React.ReactNode
  /** Density (controlled). */
  density?: "comfortable" | "compact"
  /** Density default. */
  defaultDensity?: "comfortable" | "compact"
  /** Local-storage key for persisting density. */
  densityStorageKey?: string
  className?: string
}

/* ============================================================
   Helpers
   ============================================================ */

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" })
}

/* ============================================================
   Component
   ============================================================ */

export function DataTable<T>({
  columns,
  data,
  rowKey,
  toolbarLeft,
  toolbarRight,
  selectable = false,
  rowActions,
  onView,
  onEdit,
  bulkActions,
  pageSize: initialPageSize = 25,
  pageSizeOptions = [25, 50, 100],
  defaultSort,
  isLoading = false,
  emptyState,
  defaultDensity = "comfortable",
  densityStorageKey = "gymtech.table_density",
  className,
}: DataTableProps<T>) {
  const prefersReducedMotion = useReducedMotion()
  const [sort, setSort] = React.useState<{ id: string; direction: "asc" | "desc" } | null>(
    defaultSort ?? null
  )
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(initialPageSize)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [density, setDensity] = React.useState<"comfortable" | "compact">(defaultDensity)

  // Hydrate density from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(densityStorageKey)
      if (stored === "comfortable" || stored === "compact") setDensity(stored)
    } catch {
      /* ignore */
    }
  }, [densityStorageKey])

  const persistDensity = (d: "comfortable" | "compact") => {
    setDensity(d)
    try {
      localStorage.setItem(densityStorageKey, d)
    } catch {
      /* ignore */
    }
  }

  // Sort
  const sorted = React.useMemo(() => {
    if (!sort) return data
    const col = columns.find((c) => c.id === sort.id)
    if (!col?.sortAccessor) return data
    const dir = sort.direction === "asc" ? 1 : -1
    return [...data].sort((a, b) => compareValues(col.sortAccessor!(a), col.sortAccessor!(b)) * dir)
  }, [data, sort, columns])

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pageStart = safePage * pageSize
  const pageRows = sorted.slice(pageStart, pageStart + pageSize)

  React.useEffect(() => {
    setPage(0)
  }, [pageSize, sort, data])

  // Selection
  const allOnPageSelected =
    selectable && pageRows.length > 0 && pageRows.every((r) => selected.has(rowKey(r)))
  const someOnPageSelected =
    selectable && pageRows.some((r) => selected.has(rowKey(r))) && !allOnPageSelected
  const selectedRows = React.useMemo(
    () => data.filter((r) => selected.has(rowKey(r))),
    [data, selected, rowKey]
  )

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) {
        pageRows.forEach((r) => next.delete(rowKey(r)))
      } else {
        pageRows.forEach((r) => next.add(rowKey(r)))
      }
      return next
    })
  }
  const toggleOne = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const clearSelection = () => setSelected(new Set())

  const onHeaderClick = (col: DataTableColumn<T>) => {
    if (col.disableSort || !col.sortAccessor) return
    setSort((prev) => {
      if (!prev || prev.id !== col.id) return { id: col.id, direction: "asc" }
      if (prev.direction === "asc") return { id: col.id, direction: "desc" }
      return null
    })
  }

  const showActionsColumn = !!(rowActions?.length || onView || onEdit)
  const totalColCount =
    columns.length + (selectable ? 1 : 0) + (showActionsColumn ? 1 : 0)

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Toolbar */}
      {(toolbarLeft || toolbarRight) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">{toolbarLeft}</div>
          <div className="flex items-center gap-2 shrink-0">{toolbarRight}</div>
        </div>
      )}

      {/* Table surface */}
      <div className="gt-table-wrapper">
        <div className="relative w-full overflow-auto">
          <table className="gt-table">
            <thead className="gt-table-thead">
              <tr>
                {selectable && (
                  <th className="gt-table-th w-10">
                    <Checkbox
                      checked={someOnPageSelected ? "indeterminate" : allOnPageSelected}
                      onCheckedChange={toggleAllOnPage}
                      aria-label="Select all rows on this page"
                    />
                  </th>
                )}
                {columns.map((col) => {
                  const isSorted = sort?.id === col.id
                  const canSort = !col.disableSort && !!col.sortAccessor
                  return (
                    <th
                      key={col.id}
                      scope="col"
                      className={cn(
                        "gt-table-th",
                        col.numeric && "text-right",
                        canSort && "sortable",
                        col.headerClassName,
                        col.widthClass
                      )}
                      onClick={() => onHeaderClick(col)}
                    >
                      <span className={cn("inline-flex items-center gap-1.5", col.numeric && "justify-end w-full")}>
                        {col.header}
                        {canSort && (
                          <span className="sort-icon">
                            {isSorted ? (
                              sort?.direction === "asc" ? (
                                <ArrowUp className="size-3" />
                              ) : (
                                <ArrowDown className="size-3" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3" />
                            )}
                          </span>
                        )}
                      </span>
                    </th>
                  )
                })}
                {showActionsColumn && (
                  <th scope="col" className="gt-table-th w-12 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="gt-table-tr">
                    {Array.from({ length: totalColCount }).map((__, j) => (
                      <td key={j} className="gt-table-td">
                        <div className="gt-skel h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={totalColCount} className="gt-table-td">
                    {emptyState ?? (
                      <div className="py-10 text-center text-meta font-mono">
                        No results.
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIndex) => {
                  const key = rowKey(row)
                  const isSelected = selected.has(key)
                  return (
                    <tr
                      key={key}
                      className={cn(
                        "gt-table-tr",
                        density === "compact" && "compact",
                        isSelected && "selected"
                      )}
                      data-state={isSelected ? "selected" : undefined}
                    >
                      {selectable && (
                        <td className="gt-table-td w-10">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(key)}
                            aria-label={`Select row ${rowIndex + 1}`}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={cn(
                            "gt-table-td",
                            col.numeric && "text-right",
                            col.cellClassName
                          )}
                        >
                          {col.cell(row, rowIndex)}
                        </td>
                      ))}
                      {showActionsColumn && (
                        <td className="gt-table-td w-12 text-right">
                          <RowActionsMenu
                            row={row}
                            rowActions={rowActions}
                            onView={onView}
                            onEdit={onEdit}
                          />
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: pagination + density */}
        <div className="gt-table-footer">
          <div className="flex items-center gap-3">
            <span className="font-mono">
              {sorted.length === 0
                ? "0 rows"
                : `${pageStart + 1}–${Math.min(pageStart + pageSize, sorted.length)} of ${sorted.length}`}
            </span>
            <DensityToggle density={density} onChange={persistDensity} />
          </div>
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] uppercase tracking-wider">Rows per page</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-7 rounded-md border border-border bg-card px-2 text-xs font-mono focus-ring"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-0.5 ml-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPage(0)}
                disabled={safePage === 0}
                className="size-7"
                aria-label="First page"
              >
                <ChevronsLeft className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="size-7"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="font-mono text-[10px] px-1.5">
                {safePage + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="size-7"
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPage(totalPages - 1)}
                disabled={safePage >= totalPages - 1}
                className="size-7"
                aria-label="Last page"
              >
                <ChevronsRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk action toolbar */}
      <AnimatePresence>
        {selectable && selected.size > 0 && bulkActions && bulkActions.length > 0 && (
          <motion.div
            initial={prefersReducedMotion ? false : { y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { y: 12, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="sticky bottom-3 z-20 flex items-center gap-2 rounded-xl border border-primary/30 bg-card/95 backdrop-blur-md shadow-lg px-3 py-2"
            role="region"
            aria-label="Bulk actions"
          >
            <span className="text-xs font-mono font-bold text-primary">
              {selected.size} selected
            </span>
            <span className="h-4 w-px bg-border mx-1" />
            {bulkActions.map((action) => {
              const Icon = action.icon
              const disabled = !!action.disabled?.(selectedRows)
              return (
                <Button
                  key={action.id}
                  size="sm"
                  variant={action.destructive ? "destructive" : "outline"}
                  disabled={disabled}
                  onClick={() => action.onClick(selectedRows)}
                  className="text-xs"
                  icon={Icon ? <Icon className="size-3.5" /> : undefined}
                >
                  {action.label}
                </Button>
              )
            })}
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              className="ml-auto text-xs"
            >
              Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ============================================================
   Sub-components
   ============================================================ */

function RowActionsMenu<T>({
  row,
  rowActions,
  onView,
  onEdit,
}: {
  row: T
  rowActions?: DataTableRowAction<T>[]
  onView?: (row: T) => void
  onEdit?: (row: T) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Row actions"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-ring"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {onView && (
          <DropdownMenuItem onClick={() => onView(row)}>
            <Eye className="mr-2 size-3.5" /> View
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={() => onEdit(row)}>
            <Pencil className="mr-2 size-3.5" /> Edit
          </DropdownMenuItem>
        )}
        {(onView || onEdit) && rowActions?.length ? <DropdownMenuSeparator /> : null}
        {rowActions?.map((action) => {
          const Icon = action.icon
          return (
            <DropdownMenuItem
              key={action.id}
              onClick={() => action.onClick(row)}
              className={cn(action.destructive && "text-destructive focus:text-destructive")}
            >
              {Icon ? <Icon className="mr-2 size-3.5" /> : null}
              {action.label}
            </DropdownMenuItem>
          )
        })}
        {!onView && !onEdit && !rowActions?.length && (
          <DropdownMenuLabel className="text-xs text-muted-foreground">No actions</DropdownMenuLabel>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DensityToggle({
  density,
  onChange,
}: {
  density: "comfortable" | "compact"
  onChange: (d: "comfortable" | "compact") => void
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("comfortable")}
        className={cn(
          "px-2 h-6 text-[10px] font-mono uppercase tracking-wider transition-colors",
          density === "comfortable" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Comfortable density"
        aria-pressed={density === "comfortable"}
      >
        Comfortable
      </button>
      <button
        type="button"
        onClick={() => onChange("compact")}
        className={cn(
          "px-2 h-6 text-[10px] font-mono uppercase tracking-wider transition-colors border-l border-border",
          density === "compact" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Compact density"
        aria-pressed={density === "compact"}
      >
        Compact
      </button>
    </div>
  )
}

/** Tiny re-export so consumers can wrap their own tables with the same shimmer loader. */
export const DataTableLoading: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => (
  <div className="rounded-lg border border-border bg-card overflow-hidden">
    <div className="p-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0">
          {Array.from({ length: cols }).map((__, j) => (
            <div key={j} className="h-3.5 flex-1 rounded bg-muted/60 shimmer-effect" />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-2 pt-3 text-xs text-muted-foreground font-mono">
        <Loader2 className="size-3 animate-spin" /> Loading…
      </div>
    </div>
  </div>
)
