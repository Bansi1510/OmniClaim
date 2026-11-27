'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type RowSelectionState,
  type VisibilityState,
  type GroupingState,
  type ExpandedState,
  type ColumnSizingState,
  type FilterFn,
} from '@tanstack/react-table';
import { rankItem } from '@tanstack/match-sorter-utils';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { GridActionMenu, type GridAction } from './grid-action-menu';

/**
 * Enterprise DataGrid — mirrors the College ERP DevExtreme DataGrid feature set:
 *  Filter row (text + lookup selects) · Header filter distinct-value popovers ·
 *  Group panel with drag-to-group + expand/collapse · Search panel · Sortable & resizable headers ·
 *  Row selection · Column chooser with reset · Export CSV & Excel (.xls) (selected / filtered) ·
 *  Summary footer (count / sum / custom) · Client or server pagination with page-size selector ·
 *  Role-gated Action column.
 */
export type GridValue = string | number | boolean | null | undefined;

export interface ColumnFilterValue {
  text?: string;
  selected?: string[];
}

export interface GridColumn<T> {
  id: string;
  header: string;
  /** Plain value used for sorting, filtering, grouping, global search and export. */
  accessor?: (row: T) => GridValue;
  /** Custom cell renderer (defaults to the accessor value). */
  cell?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  minWidth?: number;
  /** Initial column width (px) for resizing. */
  width?: number;
  /** Start hidden — can be enabled from the column chooser. */
  hidden?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  /** Renders a `<select>` lookup filter in the Filter Row (like DevExtreme `<Lookup>`). */
  filterOptions?: Array<{ label: string; value: string }>;
  /** Allow grouping by this column (defaults to true when `accessor` is provided). */
  groupable?: boolean;
  /** Allow header filter distinct-value checklist popover (defaults to true when `accessor` is provided and `filterable !== false`). */
  headerFilter?: boolean;
  /** Renders a `<tfoot>` summary cell over filtered rows. */
  summary?: 'count' | 'sum' | ((rows: T[]) => React.ReactNode);
  exportable?: boolean;
}

export interface ServerPaginationConfig {
  total: number;
  pageIndex: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export interface DataGridProps<T> {
  data: T[];
  columns: GridColumn<T>[];
  rowKey: (row: T) => string;
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  pageSizes?: number[];
  loading?: boolean;
  selectable?: boolean;
  /** Role-wise row actions. Return only actions the current role may run. Column auto-hides when nobody has any. */
  actions?: (row: T) => Array<GridAction | null | false | undefined>;
  actionsHeader?: string;
  onRefresh?: () => void;
  toolbar?: React.ReactNode;
  exportFileName?: string;
  emptyMessage?: string;
  showFilterRow?: boolean;
  showBorders?: boolean;
  showColumnLines?: boolean;
  striped?: boolean;
  compact?: boolean;
  maxHeight?: string;
  enableGrouping?: boolean;
  allowExport?: boolean;
  serverPagination?: ServerPaginationConfig;
  rowClassName?: (row: T) => string | undefined;
  onSelectionChange?: (rows: T[]) => void;
  /** Footer slot, e.g. totals or role-scope note. */
  footer?: React.ReactNode;
}

function normalizeFilterValue(val: unknown): ColumnFilterValue {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const obj = val as ColumnFilterValue;
    return {
      text: typeof obj.text === 'string' ? obj.text : undefined,
      selected: Array.isArray(obj.selected) ? obj.selected : undefined,
    };
  }
  if (typeof val === 'string' && val.length > 0) {
    return { text: val };
  }
  return {};
}

function hasActiveColumnFilter(val: unknown): boolean {
  const norm = normalizeFilterValue(val);
  return Boolean((norm.text && norm.text.trim().length > 0) || (norm.selected && norm.selected.length > 0));
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const raw = row.getValue(columnId);
  const itemRank = rankItem(raw === null || raw === undefined ? '' : String(raw), String(value ?? ''));
  addMeta({ itemRank });
  return itemRank.passed;
};

const smartFilter: FilterFn<any> = (row, columnId, value) => {
  const norm = normalizeFilterValue(value);
  const raw = row.getValue(columnId);
  const str = raw === null || raw === undefined ? '' : String(raw);
  if (norm.text && norm.text.trim().length > 0) {
    if (!str.toLowerCase().includes(norm.text.trim().toLowerCase())) {
      return false;
    }
  }
  if (norm.selected && norm.selected.length > 0) {
    if (!norm.selected.includes(str)) {
      return false;
    }
  }
  return true;
};

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function ColumnFilterInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  const debounced = useDebounced(local, 250);
  const first = useRef(true);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="relative flex items-center">
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Filter..."
        onClick={(e) => e.stopPropagation()}
        className="w-full min-w-[70px] rounded border border-border bg-background px-1.5 py-0.5 pr-5 text-[11px] font-normal normal-case text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {local && (
        <button
          type="button"
          title="Clear column filter"
          onClick={(e) => {
            e.stopPropagation();
            setLocal('');
            onChange('');
          }}
          className="absolute right-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  title,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  title?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      title={title}
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-[hsl(var(--primary))]"
    />
  );
}

interface HeaderFilterPopoverProps {
  columnHeader: string;
  options: Array<{ value: string; count: number }>;
  selected: string[];
  onApply: (selected: string[]) => void;
  onClose: () => void;
}

function HeaderFilterPopover({
  columnHeader,
  options,
  selected,
  onApply,
  onClose,
}: HeaderFilterPopoverProps) {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected));
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.value.toLowerCase().includes(q)) : options;
  }, [options, search]);

  const allChecked = filtered.length > 0 && filtered.every((o) => draft.has(o.value));

  const toggleAll = () => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        filtered.forEach((o) => next.delete(o.value));
      } else {
        filtered.forEach((o) => next.add(o.value));
      }
      return next;
    });
  };

  const toggleOne = (val: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  return (
    <div
      ref={boxRef}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-full z-40 mt-1 w-60 rounded-xl border border-border bg-card p-2.5 text-left font-normal normal-case shadow-2xl"
    >
      <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-1.5">
        <span className="text-[11px] font-bold text-foreground truncate">Filter: {columnHeader}</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search values..."
          className="w-full rounded border border-border bg-background py-1 pl-6 pr-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <label className="mb-1 flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted">
        <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" />
        <span>(Select All)</span>
      </label>

      <div className="max-h-44 space-y-0.5 overflow-y-auto border-y border-border/50 py-1">
        {filtered.length === 0 ? (
          <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">No matching values</div>
        ) : (
          filtered.map((opt) => (
            <label
              key={opt.value || '__empty'}
              className="flex cursor-pointer items-center justify-between gap-2 rounded px-1.5 py-1 text-[11px] text-foreground hover:bg-muted"
            >
              <span className="flex items-center gap-2 truncate">
                <input
                  type="checkbox"
                  checked={draft.has(opt.value)}
                  onChange={() => toggleOne(opt.value)}
                  className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                />
                <span className="truncate">{opt.value === '' ? '(Blank)' : opt.value}</span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{opt.count}</span>
            </label>
          ))
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            onApply([]);
            onClose();
          }}
          className="rounded border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(Array.from(draft));
            onClose();
          }}
          className="rounded bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export function DataGrid<T>({
  data,
  columns,
  rowKey,
  title,
  subtitle,
  searchPlaceholder = 'Search all columns...',
  pageSize = 10,
  pageSizes = [10, 25, 50, 100],
  loading = false,
  selectable = false,
  actions,
  actionsHeader = 'Actions',
  onRefresh,
  toolbar,
  exportFileName = 'omniclaim-export',
  emptyMessage = 'No records found.',
  showFilterRow = true,
  showBorders = true,
  showColumnLines = true,
  striped = true,
  compact = false,
  maxHeight,
  enableGrouping = true,
  allowExport = true,
  serverPagination,
  rowClassName,
  onSelectionChange,
  footer,
}: DataGridProps<T>) {
  const defaultVisibility = useMemo(() => {
    const init: VisibilityState = {};
    columns.forEach((c) => {
      if (c.hidden) init[c.id] = false;
    });
    return init;
  }, [columns]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [searchInput, setSearchInput] = useState(serverPagination?.searchValue ?? '');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [filterRowVisible, setFilterRowVisible] = useState(showFilterRow);
  const [groupPanelVisible, setGroupPanelVisible] = useState(enableGrouping && !serverPagination);
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [chooserOpen, setChooserOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [activeHeaderFilterId, setActiveHeaderFilterId] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultVisibility);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });
  const chooserRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (serverPagination?.searchValue !== undefined && serverPagination.searchValue !== searchInput) {
      setSearchInput(serverPagination.searchValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPagination?.searchValue]);

  const debouncedSearch = useDebounced(searchInput, 300);
  useEffect(() => {
    if (serverPagination?.onSearchChange) {
      serverPagination.onSearchChange(debouncedSearch);
      return;
    }
    setGlobalFilter(debouncedSearch);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Role-wise: action column is only shown when at least one row exposes an action to this role.
  const hasAnyAction = useMemo(
    () => (actions ? data.some((row) => actions(row).filter(Boolean).length > 0) : false),
    [actions, data]
  );

  // Distinct value counts per column for the Header Filter checklist popover
  const distinctByCol = useMemo(() => {
    const map = new Map<string, Array<{ value: string; count: number }>>();
    columns.forEach((col) => {
      if (!col.accessor || col.filterable === false || col.headerFilter === false) return;
      const counts = new Map<string, number>();
      data.forEach((row) => {
        const raw = col.accessor!(row);
        const key = raw === null || raw === undefined ? '' : String(raw);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      const list = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
      map.set(col.id, list);
    });
    return map;
  }, [columns, data]);

  const columnDefs = useMemo<ColumnDef<T, any>[]>(() => {
    const defs: ColumnDef<T, any>[] = [];

    if (selectable) {
      defs.push({
        id: '__select',
        size: 38,
        enableSorting: false,
        enableColumnFilter: false,
        enableGlobalFilter: false,
        enableGrouping: false,
        enableResizing: false,
        enableHiding: false,
        header: ({ table }) => (
          <IndeterminateCheckbox
            title="Select all rows on this page"
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <IndeterminateCheckbox
            title="Select row"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        meta: { align: 'center', exportable: false },
      });
    }

    columns.forEach((c) => {
      const hasAccessor = Boolean(c.accessor);
      defs.push({
        id: c.id,
        header: c.header,
        size: c.width,
        minSize: c.minWidth ?? 60,
        accessorFn: (row) => (c.accessor ? c.accessor(row) : ''),
        enableSorting: hasAccessor && c.sortable !== false,
        enableColumnFilter: hasAccessor && c.filterable !== false,
        enableGlobalFilter: hasAccessor,
        enableGrouping: hasAccessor && enableGrouping && !serverPagination && c.groupable !== false,
        enableResizing: true,
        filterFn: smartFilter,
        sortingFn: 'alphanumeric',
        cell: ({ row, getValue }) => {
          if (c.cell) return c.cell(row.original);
          const v = getValue();
          return v === null || v === undefined || v === '' ? '—' : String(v);
        },
        meta: {
          align: c.align,
          minWidth: c.minWidth,
          exportable: c.exportable !== false && hasAccessor,
          filterOptions: c.filterOptions,
          headerFilter: hasAccessor && c.filterable !== false && c.headerFilter !== false,
          summary: c.summary,
          gridColumn: c,
        },
      });
    });

    if (actions && hasAnyAction) {
      defs.push({
        id: '__actions',
        header: actionsHeader,
        enableSorting: false,
        enableColumnFilter: false,
        enableGlobalFilter: false,
        enableGrouping: false,
        enableHiding: false,
        cell: ({ row }) => <GridActionMenu actions={actions(row.original)} />,
        meta: { align: 'right', minWidth: 110, exportable: false },
      });
    }

    return defs;
  }, [columns, selectable, actions, hasAnyAction, actionsHeader, enableGrouping, serverPagination]);

  const effectivePagination = serverPagination
    ? { pageIndex: serverPagination.pageIndex, pageSize: serverPagination.pageSize }
    : pagination;

  const serverPageCount = serverPagination
    ? Math.max(1, Math.ceil(serverPagination.total / Math.max(1, serverPagination.pageSize)))
    : undefined;

  const table = useReactTable({
    data,
    columns: columnDefs,
    getRowId: (row) => rowKey(row),
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
      columnVisibility,
      grouping,
      expanded,
      columnSizing,
      pagination: effectivePagination,
    },
    columnResizeMode: 'onChange',
    manualPagination: Boolean(serverPagination),
    pageCount: serverPageCount,
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater) => {
      setColumnFilters(updater);
      if (!serverPagination) setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onColumnSizingChange: setColumnSizing,
    onPaginationChange: (updater) => {
      if (serverPagination) {
        const next = typeof updater === 'function' ? updater(effectivePagination) : updater;
        if (next.pageSize !== serverPagination.pageSize) {
          serverPagination.onPageSizeChange(next.pageSize);
        } else if (next.pageIndex !== serverPagination.pageIndex) {
          serverPagination.onPageChange(next.pageIndex);
        }
      } else {
        setPagination(updater);
      }
    },
    enableRowSelection: selectable,
    globalFilterFn: fuzzyFilter,
    filterFns: { fuzzy: fuzzyFilter, smart: smartFilter },
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Keep client page index valid when rows disappear (delete / filter).
  const pageCount = serverPagination ? serverPageCount! : table.getPageCount();
  useEffect(() => {
    if (!serverPagination && pagination.pageIndex > 0 && pagination.pageIndex >= pageCount) {
      setPagination((p) => ({ ...p, pageIndex: Math.max(0, pageCount - 1) }));
    }
  }, [pageCount, pagination.pageIndex, serverPagination]);

  useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange(table.getSelectedRowModel().rows.filter((r) => !r.getIsGrouped()).map((r) => r.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  useEffect(() => {
    if (!chooserOpen && !exportOpen) return undefined;
    const onDown = (e: MouseEvent) => {
      if (chooserOpen && chooserRef.current && !chooserRef.current.contains(e.target as Node)) {
        setChooserOpen(false);
      }
      if (exportOpen && exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [chooserOpen, exportOpen]);

  const filteredLeafRows = useMemo(
    () => table.getPrePaginationRowModel().rows.filter((r) => !r.getIsGrouped()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getPrePaginationRowModel().rows]
  );

  const filteredCount = serverPagination ? serverPagination.total : filteredLeafRows.length;
  const selectedCount = Object.keys(rowSelection).length;
  const activeColumnFilterEntries = columnFilters.filter((cf) => hasActiveColumnFilter(cf.value));
  const activeFilterCount = activeColumnFilterEntries.length + (globalFilter ? 1 : 0);
  const { pageIndex, pageSize: size } = effectivePagination;
  const firstItem = filteredCount === 0 ? 0 : pageIndex * size + 1;
  const lastItem = Math.min(filteredCount, (pageIndex + 1) * size);

  const getExportData = () => {
    const exportCols = table.getVisibleLeafColumns().filter((c) => (c.columnDef.meta as any)?.exportable);
    const rows =
      selectedCount > 0
        ? table.getSelectedRowModel().rows.filter((r) => !r.getIsGrouped())
        : filteredLeafRows;
    return { exportCols, rows };
  };

  const handleExportCsv = () => {
    const { exportCols, rows } = getExportData();
    const esc = (v: unknown) => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;
    const header = exportCols.map((c) => esc(c.columnDef.header)).join(',');
    const lines = rows.map((r) => exportCols.map((c) => esc(r.getValue(c.id))).join(','));
    const blob = new Blob(['\uFEFF' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const handleExportExcel = () => {
    const { exportCols, rows } = getExportData();
    const escHtml = (v: unknown) =>
      String(v === null || v === undefined ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const ths = exportCols.map((c) => `<th style="background:#f1f5f9;font-weight:bold;border:1px solid #cbd5e1;padding:6px">${escHtml(c.columnDef.header)}</th>`).join('');
    const trs = rows
      .map(
        (r) =>
          `<tr>${exportCols
            .map((c) => `<td style="border:1px solid #cbd5e1;padding:5px">${escHtml(r.getValue(c.id))}</td>`)
            .join('')}</tr>`
      )
      .join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head><body><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileName}-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const clearFilters = () => {
    setSearchInput('');
    setGlobalFilter('');
    setColumnFilters([]);
    if (serverPagination?.onSearchChange) serverPagination.onSearchChange('');
  };

  const pageButtons = useMemo(() => {
    const total = pageCount;
    const current = pageIndex;
    const start = Math.max(0, Math.min(current - 2, total - 5));
    const end = Math.min(total, start + 5);
    return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
  }, [pageCount, pageIndex]);

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const colCount = visibleLeafColumns.length;
  const hasSummaryRow = visibleLeafColumns.some((c) => Boolean((c.columnDef.meta as any)?.summary));
  const filteredOriginals = useMemo(() => filteredLeafRows.map((r) => r.original), [filteredLeafRows]);

  const groupableColumns = useMemo(
    () =>
      table
        .getAllLeafColumns()
        .filter((c) => c.getCanGroup() && !grouping.includes(c.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnDefs, grouping]
  );

  const cellPadding = compact ? 'px-2.5 py-1.5' : 'px-3 py-2.5';
  const headPadding = compact ? 'px-2.5 py-2' : 'px-3 py-2.5';
  const colLineClass = showColumnLines ? 'border-r border-border/60 last:border-r-0' : '';

  return (
    <div
      className={`rounded-xl bg-card shadow-sm ${showBorders ? 'border border-border' : ''}`}
      data-datagrid="true"
    >
      {/* Card header + toolbar (title, refresh, search panel, group toggle, filters, chooser, export, custom actions) */}
      <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          {title && (
            <div>
              <h3 className="text-sm font-bold leading-tight text-foreground">{title}</h3>
              {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          {onRefresh && (
            <button
              type="button"
              title="Refresh"
              onClick={onRefresh}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search grid"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-56 rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary sm:w-64"
            />
          </div>

          {enableGrouping && !serverPagination && (
            <button
              type="button"
              title="Toggle Group Panel"
              onClick={() => setGroupPanelVisible((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                groupPanelVisible || grouping.length > 0
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> Group{grouping.length > 0 ? ` (${grouping.length})` : ''}
            </button>
          )}

          <button
            type="button"
            title="Toggle filter row"
            onClick={() => setFilterRowVisible((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
              filterRowVisible ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <Filter className="h-3.5 w-3.5" /> Filters
          </button>

          <div className="relative" ref={chooserRef}>
            <button
              type="button"
              title="Column chooser"
              onClick={() => setChooserOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Columns
            </button>
            {chooserOpen && (
              <div className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-border bg-card p-2 shadow-2xl">
                <div className="mb-1.5 flex items-center justify-between border-b border-border/60 px-1 pb-1 text-[11px] font-bold text-foreground">
                  <span>Column Chooser</span>
                  <button
                    type="button"
                    onClick={() => {
                      setColumnVisibility(defaultVisibility);
                      setColumnSizing({});
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Reset
                  </button>
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {table
                    .getAllLeafColumns()
                    .filter((c) => c.getCanHide())
                    .map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted">
                        <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} />
                        <span className="truncate">{String(c.columnDef.header)}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          {allowExport && (
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                title={selectedCount > 0 ? 'Export selected rows' : 'Export all filtered rows'}
                onClick={() => setExportOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" /> Export{selectedCount > 0 ? ` (${selectedCount})` : ''}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-2xl">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5 text-primary" />
                    <span>Export CSV {selectedCount > 0 ? '(Selected)' : '(Filtered)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Export Excel (.xls)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {toolbar}
        </div>
      </div>

      {/* Group Panel (DevExtreme <GroupPanel />) */}
      {groupPanelVisible && enableGrouping && !serverPagination && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const colId = e.dataTransfer.getData('text/datagrid-col');
            if (colId && !grouping.includes(colId)) {
              setGrouping((prev) => [...prev, colId]);
            }
          }}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/25 px-3 py-1.5 text-[11px]"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-muted-foreground">Group Panel:</span>
            {grouping.length === 0 ? (
              <span className="italic text-muted-foreground">Drag a column header here or pick a column to group</span>
            ) : (
              grouping.map((colId) => {
                const col = table.getColumn(colId);
                return (
                  <span
                    key={colId}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-semibold text-primary"
                  >
                    <span>{col ? String(col.columnDef.header) : colId}</span>
                    <button
                      type="button"
                      onClick={() => setGrouping((prev) => prev.filter((id) => id !== colId))}
                      className="hover:text-foreground"
                      title="Remove grouping"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2">
            {groupableColumns.length > 0 && (
              <select
                aria-label="Add group column"
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !grouping.includes(val)) setGrouping((prev) => [...prev, val]);
                }}
                className="rounded border border-border bg-background px-2 py-0.5 text-[11px] text-foreground"
              >
                <option value="">+ Group by...</option>
                {groupableColumns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {String(c.columnDef.header)}
                  </option>
                ))}
              </select>
            )}
            {grouping.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="font-semibold text-primary hover:underline"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded({})}
                  className="font-semibold text-muted-foreground hover:text-foreground hover:underline"
                >
                  Collapse All
                </button>
                <button
                  type="button"
                  onClick={() => setGrouping([])}
                  className="font-semibold text-rose-500 hover:underline"
                >
                  Clear Groups
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Active filter panel (like DevExtreme FilterPanel) */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/5 px-3 py-1.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">
              <strong className="text-foreground">{activeFilterCount}</strong> active filter(s) · showing{' '}
              <strong className="text-foreground">{filteredCount}</strong> of{' '}
              <strong className="text-foreground">{serverPagination ? serverPagination.total : data.length}</strong> records
            </span>
            {globalFilter && (
              <span className="inline-flex items-center gap-1 rounded border border-primary/30 bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                Search: &quot;{globalFilter}&quot;
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setGlobalFilter('');
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            {activeColumnFilterEntries.map((cf) => {
              const col = table.getColumn(cf.id);
              const norm = normalizeFilterValue(cf.value);
              const parts: string[] = [];
              if (norm.text) parts.push(`~"${norm.text}"`);
              if (norm.selected && norm.selected.length > 0) parts.push(`[${norm.selected.length} selected]`);
              return (
                <span
                  key={cf.id}
                  className="inline-flex items-center gap-1 rounded border border-primary/30 bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                >
                  <span>{col ? String(col.columnDef.header) : cf.id}: {parts.join(' & ')}</span>
                  <button
                    type="button"
                    onClick={() => col?.setFilterValue(undefined)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
          <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            <X className="h-3 w-3" /> Clear all
          </button>
        </div>
      )}

      {selectedCount > 0 && (
        <div className="flex items-center justify-between border-b border-border bg-amber-500/10 px-3 py-1.5 text-[11px]">
          <span className="font-semibold text-amber-500">{selectedCount} row(s) selected</span>
          <button type="button" onClick={() => setRowSelection({})} className="font-semibold text-amber-500 hover:underline">
            Deselect all
          </button>
        </div>
      )}

      <div className="overflow-x-auto" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/60 text-muted-foreground backdrop-blur">
            {table.getHeaderGroups().map((hg) => (
              <React.Fragment key={hg.id}>
                <tr>
                  {hg.headers.map((header) => {
                    const meta = header.column.columnDef.meta as any;
                    const sorted = header.column.getIsSorted();
                    const canSort = header.column.getCanSort();
                    const canGroup = header.column.getCanGroup();
                    const canHeaderFilter = Boolean(meta?.headerFilter);
                    const normFilter = normalizeFilterValue(header.column.getFilterValue());
                    const hasHeaderSelection = Boolean(normFilter.selected && normFilter.selected.length > 0);
                    const isPopoverOpen = activeHeaderFilterId === header.column.id;

                    return (
                      <th
                        key={header.id}
                        draggable={canGroup}
                        onDragStart={(e) => {
                          if (!canGroup) return;
                          e.dataTransfer.setData('text/datagrid-col', header.column.id);
                        }}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        style={{
                          minWidth: meta?.minWidth,
                          width: header.column.getSize() !== 150 ? header.column.getSize() : undefined,
                        }}
                        className={`relative whitespace-nowrap ${headPadding} ${colLineClass} text-[11px] font-semibold uppercase ${
                          meta?.align === 'right' ? 'text-right' : meta?.align === 'center' ? 'text-center' : ''
                        } ${canSort ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
                      >
                        <div
                          className={`inline-flex w-full items-center gap-1 ${
                            meta?.align === 'right' ? 'justify-end' : meta?.align === 'center' ? 'justify-center' : 'justify-between'
                          }`}
                        >
                          <span className={`inline-flex items-center gap-1 ${meta?.align === 'right' ? 'flex-row-reverse' : ''}`}>
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort &&
                              (sorted === 'asc' ? (
                                <ChevronUp className="h-3 w-3 text-primary" />
                              ) : sorted === 'desc' ? (
                                <ChevronDown className="h-3 w-3 text-primary" />
                              ) : (
                                <ChevronsUpDown className="h-3 w-3 opacity-40" />
                              ))}
                          </span>

                          {canHeaderFilter && (
                            <button
                              type="button"
                              title="Header value filter"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveHeaderFilterId((prev) => (prev === header.column.id ? null : header.column.id));
                              }}
                              className={`rounded p-0.5 transition ${
                                hasHeaderSelection || isPopoverOpen
                                  ? 'bg-primary/15 text-primary'
                                  : 'text-muted-foreground/60 hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              <Filter className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {isPopoverOpen && canHeaderFilter && (
                          <HeaderFilterPopover
                            columnHeader={String(header.column.columnDef.header)}
                            options={distinctByCol.get(header.column.id) || []}
                            selected={normFilter.selected || []}
                            onApply={(nextSelected) => {
                              const current = normalizeFilterValue(header.column.getFilterValue());
                              const next: ColumnFilterValue = {
                                text: current.text,
                                selected: nextSelected.length > 0 ? nextSelected : undefined,
                              };
                              header.column.setFilterValue(next.text || next.selected ? next : undefined);
                            }}
                            onClose={() => setActiveHeaderFilterId(null)}
                          />
                        )}

                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-primary/60 ${
                              header.column.getIsResizing() ? 'bg-primary' : ''
                            }`}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
                {filterRowVisible && (
                  <tr className="border-t border-border/60 bg-background/60">
                    {hg.headers.map((header) => {
                      const meta = header.column.columnDef.meta as any;
                      const filterOptions = meta?.filterOptions as Array<{ label: string; value: string }> | undefined;
                      const norm = normalizeFilterValue(header.column.getFilterValue());
                      return (
                        <th key={`${header.id}-f`} className={`px-2 py-1.5 font-normal ${colLineClass}`}>
                          {header.column.getCanFilter() ? (
                            filterOptions && filterOptions.length > 0 ? (
                              <select
                                aria-label={`Filter ${String(header.column.columnDef.header)}`}
                                value={norm.text ?? ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const next: ColumnFilterValue = {
                                    text: val || undefined,
                                    selected: norm.selected,
                                  };
                                  header.column.setFilterValue(next.text || next.selected ? next : undefined);
                                }}
                                className="w-full min-w-[75px] rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="">All</option>
                                {filterOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <ColumnFilterInput
                                value={norm.text ?? ''}
                                onChange={(v) => {
                                  const current = normalizeFilterValue(header.column.getFilterValue());
                                  const next: ColumnFilterValue = {
                                    text: v || undefined,
                                    selected: current.selected,
                                  };
                                  header.column.setFilterValue(next.text || next.selected ? next : undefined);
                                }}
                              />
                            )
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                )}
              </React.Fragment>
            ))}
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              Array.from({ length: Math.min(5, size) }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  {Array.from({ length: colCount }).map((__, j) => (
                    <td key={j} className={`${cellPadding} ${colLineClass}`}>
                      <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, colCount)} className="px-3 py-10 text-center text-muted-foreground">
                  {activeFilterCount > 0 ? 'No records match the current filters.' : emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, rowIdx) => {
                if (row.getIsGrouped()) {
                  const groupCol = table.getColumn(row.groupingColumnId || '');
                  const groupLabel = groupCol ? String(groupCol.columnDef.header) : row.groupingColumnId;
                  return (
                    <tr
                      key={row.id}
                      onClick={row.getToggleExpandedHandler()}
                      className="cursor-pointer bg-muted/40 font-semibold text-foreground transition hover:bg-muted/70"
                    >
                      <td colSpan={Math.max(1, colCount)} className="px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          {row.getIsExpanded() ? (
                            <ChevronDown className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span className="text-muted-foreground">{groupLabel}:</span>
                          <span className="font-bold text-foreground">{String(row.groupingValue ?? '—')}</span>
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                            {row.subRows.length}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.id}
                    className={`transition hover:bg-primary/5 ${
                      striped && rowIdx % 2 === 1 ? 'bg-muted/15' : ''
                    } ${row.getIsSelected() ? 'bg-primary/10' : ''} ${rowClassName?.(row.original) || ''}`}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as any;
                      return (
                        <td
                          key={cell.id}
                          className={`${cellPadding} ${colLineClass} align-middle ${
                            meta?.align === 'right' ? 'text-right' : meta?.align === 'center' ? 'text-center' : ''
                          }`}
                        >
                          {cell.getIsPlaceholder()
                            ? null
                            : flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>

          {hasSummaryRow && filteredOriginals.length > 0 && (
            <tfoot className="border-t-2 border-border bg-muted/35 text-xs font-bold text-foreground">
              <tr>
                {visibleLeafColumns.map((col, idx) => {
                  const meta = col.columnDef.meta as any;
                  const summarySpec = meta?.summary as GridColumn<T>['summary'];
                  const gridCol = meta?.gridColumn as GridColumn<T> | undefined;
                  let rendered: React.ReactNode = null;

                  if (summarySpec === 'count') {
                    rendered = <span className="font-mono">Count: {filteredOriginals.length}</span>;
                  } else if (summarySpec === 'sum' && gridCol?.accessor) {
                    const sum = filteredOriginals.reduce((acc, r) => acc + (Number(gridCol.accessor!(r)) || 0), 0);
                    rendered = <span className="font-mono">{sum.toLocaleString()}</span>;
                  } else if (typeof summarySpec === 'function') {
                    rendered = summarySpec(filteredOriginals);
                  } else if (idx === 0 && !selectable) {
                    rendered = <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</span>;
                  }

                  return (
                    <td
                      key={`sum-${col.id}`}
                      className={`${cellPadding} ${colLineClass} ${
                        meta?.align === 'right' ? 'text-right' : meta?.align === 'center' ? 'text-center' : ''
                      }`}
                    >
                      {rendered}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pager: page-size selector, info, numbered navigation */}
      <div className="flex flex-col gap-2 border-t border-border p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-muted-foreground">
          <label className="inline-flex items-center gap-1.5">
            Rows
            <select
              aria-label="Page size"
              value={size}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                if (serverPagination) serverPagination.onPageSizeChange(nextSize);
                else table.setPageSize(nextSize);
              }}
              className="rounded border border-border bg-background px-1.5 py-0.5 text-xs font-semibold text-foreground"
            >
              {Array.from(new Set([...pageSizes, pageSize, size])).sort((a, b) => a - b).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <span>
            {firstItem}–{lastItem} of <strong className="text-foreground">{filteredCount}</strong>
            {!serverPagination && filteredCount !== data.length ? ` (filtered from ${data.length})` : ''} · Page{' '}
            <strong className="text-foreground">{pageCount === 0 ? 0 : pageIndex + 1}</strong> of{' '}
            <strong className="text-foreground">{pageCount}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pageIndex <= 0}
            onClick={() => (serverPagination ? serverPagination.onPageChange(Math.max(0, pageIndex - 1)) : table.previousPage())}
            className="rounded-md border border-border px-2.5 py-1 font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          {pageButtons.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => (serverPagination ? serverPagination.onPageChange(p) : table.setPageIndex(p))}
              className={`min-w-[28px] rounded-md border px-2 py-1 font-semibold ${
                p === pageIndex ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'
              }`}
            >
              {p + 1}
            </button>
          ))}
          <button
            type="button"
            disabled={pageIndex >= pageCount - 1}
            onClick={() =>
              serverPagination ? serverPagination.onPageChange(Math.min(pageCount - 1, pageIndex + 1)) : table.nextPage()
            }
            className="rounded-md border border-border px-2.5 py-1 font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {footer && <div className="border-t border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">{footer}</div>}
    </div>
  );
}

export default DataGrid;
