import React, { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowUp,
  ArrowDown,
  Search,
  Zap,
  BarChart2,
  AlertCircle,
  Clock,
  Layers,
  BarChart3,
  X,
  Filter,
  FilterX,
  Copy,
  FileSpreadsheet
} from 'lucide-react';
import { QueryResult } from '../engine/types';
import { ExportDropdown } from './ExportDropdown';

interface DataGridProps {
  result: QueryResult | null;
  isExecuting: boolean;
  onOpenVisualizer: () => void;
  onApplyFilter?: (column: string, value: string, op: '=' | '!=') => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

type SortDirection = 'asc' | 'desc' | null;

interface ActiveColumnStats {
  column: string;
  type: string;
  total: number;
  distinctCount: number;
  nullCount: number;
  min?: unknown;
  max?: unknown;
  avg?: number;
  topValues: { value: string; count: number; percentage: number }[];
}

export const DataGrid: React.FC<DataGridProps> = ({
  result,
  isExecuting,
  onOpenVisualizer,
  onApplyFilter,
  onNotify,
}) => {
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [activeStats, setActiveStats] = useState<ActiveColumnStats | null>(null);
  const [rowActionMenu, setRowActionMenu] = useState<{ rowIndex: number; x: number; y: number } | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const handleSort = (col: string) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortCol(null);
      setSortDir(null);
    }
  };

  // Filtered and sorted rows
  const processedRows = useMemo(() => {
    if (!result?.rows) return [];
    let rows = [...result.rows];

    if (filterText.trim()) {
      const lower = filterText.toLowerCase();
      rows = rows.filter((row) =>
        result.columns.some((col) => {
          const val = row[col];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(lower);
        })
      );
    }

    if (sortCol && sortDir) {
      rows.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }
        return sortDir === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return rows;
  }, [result, filterText, sortCol, sortDir]);

  // Virtualizer for smooth rendering
  const rowVirtualizer = useVirtualizer({
    count: processedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 20,
  });

  const handleCellClick = async (value: unknown) => {
    if (value === null || value === undefined) return;
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await navigator.clipboard.writeText(str);
    onNotify(`Copied "${str.slice(0, 35)}${str.length > 35 ? '...' : ''}" to clipboard`, 'info');
  };

  const handleCopyRowAsJson = async (row: Record<string, unknown>) => {
    const jsonStr = JSON.stringify(row, null, 2);
    await navigator.clipboard.writeText(jsonStr);
    onNotify('Copied row as JSON to clipboard', 'success');
    setRowActionMenu(null);
  };

  const handleCopyRowAsCsv = async (row: Record<string, unknown>) => {
    if (!result?.columns) return;
    const csvLine = result.columns
      .map((c) => {
        const val = row[c];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(',');
    await navigator.clipboard.writeText(csvLine);
    onNotify('Copied row as CSV to clipboard', 'success');
    setRowActionMenu(null);
  };

  // Open instant column statistics popover
  const handleOpenStats = (col: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!result?.rows.length) return;

    if (activeStats?.column === col) {
      setActiveStats(null);
      return;
    }

    const total = result.rows.length;
    let nullCount = 0;
    const valueCounts: Record<string, number> = {};
    const numbers: number[] = [];

    for (const row of result.rows) {
      const val = row[col];
      if (val === null || val === undefined) {
        nullCount++;
      } else {
        const strVal = String(val);
        valueCounts[strVal] = (valueCounts[strVal] || 0) + 1;
        if (typeof val === 'number') {
          numbers.push(val);
        }
      }
    }

    const distinctCount = Object.keys(valueCounts).length;
    let min: unknown;
    let max: unknown;
    let avg: number | undefined;

    if (numbers.length > 0) {
      min = Math.min(...numbers);
      max = Math.max(...numbers);
      avg = Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 100) / 100;
    }

    const sortedEntries = Object.entries(valueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topValues = sortedEntries.map(([value, count]) => ({
      value,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));

    setActiveStats({
      column: col,
      type: result.columnTypes[col] || '',
      total,
      distinctCount,
      nullCount,
      min,
      max,
      avg,
      topValues,
    });
  };

  if (result?.error) {
    return (
      <div className="h-full flex flex-col bg-[#0B0F17] p-6 justify-center items-center text-center">
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 max-w-2xl w-full text-left">
          <div className="flex items-center space-x-2 text-rose-400 font-semibold mb-2 text-sm">
            <AlertCircle className="w-5 h-5" />
            <span>SQL Execution Error</span>
          </div>
          <pre className="font-mono text-xs text-rose-200 bg-black/40 p-3 rounded overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {result.error}
          </pre>
        </div>
      </div>
    );
  }

  if (isExecuting) {
    return (
      <div className="h-full flex flex-col bg-[#0B0F17] justify-center items-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <p className="text-xs text-slate-400 font-mono">Executing query in DuckDB Web Worker...</p>
      </div>
    );
  }

  if (!result || !result.columns.length) {
    return (
      <div className="h-full flex flex-col bg-[#0B0F17] justify-center items-center text-slate-500 text-xs">
        <Layers className="w-8 h-8 text-slate-700 mb-2" />
        <p className="font-medium text-slate-400">No query results</p>
        <p className="text-slate-500 mt-0.5">Press Run Query (Ctrl+Enter) to execute.</p>
      </div>
    );
  }

  // Calculate minimum total table width based on columns
  const rowNumWidth = 56;
  const colMinWidth = 160;
  const minTableWidth = rowNumWidth + result.columns.length * colMinWidth;

  return (
    <div className="h-full flex flex-col bg-[#0B0F17] select-text relative">
      {/* Top Metrics & Action Bar */}
      <div className="h-10 bg-[#0F172A] border-b border-slate-800 px-3 flex items-center justify-between text-xs shrink-0 select-none">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono font-medium">{result.rowCount.toLocaleString()}</span>
            <span className="text-slate-500">rows</span>
          </div>

          <div className="flex items-center space-x-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono">{result.executionTimeMs} ms</span>
          </div>

          <div className="text-slate-500 hidden sm:inline">
            <span className="font-mono">{result.columns.length}</span> columns
          </div>

          {filterText && (
            <div className="flex items-center space-x-1 text-[11px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              <span>Filtered: {processedRows.length} rows</span>
              <button onClick={() => setFilterText('')} className="hover:text-amber-100">
                <X className="w-3 h-3 ml-0.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick Filter Search */}
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2.5" />
            <input
              type="text"
              placeholder="Filter result rows..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-7 pr-7 py-1 bg-slate-900/90 text-slate-200 text-xs rounded border border-slate-700 focus:outline-none focus:border-amber-500/50 w-36 sm:w-48 transition-colors"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={onOpenVisualizer}
            className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1 transition-colors"
            title="Create Visual Chart"
          >
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Visualize</span>
          </button>

          <ExportDropdown result={result} onNotify={onNotify} />
        </div>
      </div>

      {/* Grid Virtualized Container */}
      <div ref={parentRef} className="flex-1 overflow-auto bg-[#0B0F17] relative">
        <div style={{ minWidth: `${minTableWidth}px`, width: '100%' }}>
          {/* Synchronized Sticky Header */}
          <div className="sticky top-0 bg-[#111827] z-20 shadow-sm border-b border-slate-800 flex text-xs font-mono select-none">
            <div
              style={{ width: `${rowNumWidth}px` }}
              className="px-2 py-2 text-center text-[10px] text-slate-500 font-semibold bg-[#0F172A] border-r border-slate-800 shrink-0"
            >
              #
            </div>
            {result.columns.map((col) => {
              const isSorted = sortCol === col;
              const colType = result.columnTypes[col] || '';
              return (
                <div
                  key={col}
                  onClick={() => handleSort(col)}
                  style={{ minWidth: `${colMinWidth}px` }}
                  className="flex-1 px-3 py-2 text-slate-300 font-semibold cursor-pointer hover:bg-slate-800/80 transition-colors border-r border-slate-800/60 whitespace-nowrap group flex items-center justify-between"
                  title="Click to sort by this column"
                >
                  <span className="text-slate-100 truncate mr-2" title={col}>
                    {col}
                  </span>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={(e) => handleOpenStats(col, e)}
                      className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-300 transition-colors"
                      title="View Column Statistics"
                    >
                      <BarChart3 className="w-3 h-3" />
                    </button>
                    <span className="text-[9px] text-slate-400 font-normal px-1 py-0.5 rounded bg-slate-800/90 font-mono">
                      {colType.length > 10 ? colType.slice(0, 8) + '..' : colType}
                    </span>
                    {isSorted && (
                      sortDir === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-amber-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Virtualized Body Rows */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = processedRows[virtualRow.index];
              const rowIndex = virtualRow.index;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="table-row-hover border-b border-slate-900 absolute top-0 left-0 w-full flex items-center text-xs font-mono h-[34px]"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    onClick={(e) => {
                      setRowActionMenu({
                        rowIndex,
                        x: Math.min(e.clientX, window.innerWidth - 180),
                        y: Math.min(e.clientY, window.innerHeight - 100),
                      });
                    }}
                    style={{ width: `${rowNumWidth}px` }}
                    className="px-2 py-1.5 text-center text-[10px] text-slate-600 bg-[#0E1522] border-r border-slate-800/80 select-none shrink-0 cursor-pointer hover:text-amber-400 hover:bg-slate-800/80"
                    title="Click for row actions"
                  >
                    {rowIndex + 1}
                  </div>
                  {result.columns.map((col) => {
                    const val = row[col];
                    const isNull = val === null || val === undefined;
                    const displayStr = isNull
                      ? 'null'
                      : typeof val === 'object'
                      ? JSON.stringify(val)
                      : String(val);

                    return (
                      <div
                        key={col}
                        onClick={() => handleCellClick(val)}
                        title="Click to copy value"
                        style={{ minWidth: `${colMinWidth}px` }}
                        className={`px-3 py-1.5 border-r border-slate-900/80 truncate cursor-pointer flex-1 ${
                          isNull ? 'text-slate-600 italic' : 'text-slate-200'
                        }`}
                      >
                        {displayStr}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row Action Context Menu */}
      {rowActionMenu && (
        <div
          className="fixed z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 text-xs w-44 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: rowActionMenu.y, left: rowActionMenu.x }}
          onMouseLeave={() => setRowActionMenu(null)}
        >
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
            Row #{rowActionMenu.rowIndex + 1}
          </div>
          <button
            onClick={() => handleCopyRowAsJson(processedRows[rowActionMenu.rowIndex])}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
          >
            <Copy className="w-3.5 h-3.5 text-cyan-400" />
            <span>Copy as JSON</span>
          </button>
          <button
            onClick={() => handleCopyRowAsCsv(processedRows[rowActionMenu.rowIndex])}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Copy as CSV</span>
          </button>
        </div>
      )}

      {/* Column Statistics Popover Card */}
      {activeStats && (
        <div className="absolute top-12 right-6 z-30 w-72 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-4 text-xs select-none animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="truncate">
              <span className="font-bold text-slate-100">{activeStats.column}</span>
              <span className="text-[10px] text-slate-400 font-mono ml-2">({activeStats.type})</span>
            </div>
            <button
              onClick={() => setActiveStats(null)}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 text-[10px]">Distinct Values</span>
              <div className="font-mono font-semibold text-amber-400">{activeStats.distinctCount.toLocaleString()}</div>
            </div>
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 text-[10px]">Null Values</span>
              <div className="font-mono font-semibold text-rose-400">{activeStats.nullCount.toLocaleString()}</div>
            </div>
            {activeStats.min !== undefined && (
              <>
                <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 text-[10px]">Min Value</span>
                  <div className="font-mono font-semibold text-cyan-400">{String(activeStats.min)}</div>
                </div>
                <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 text-[10px]">Max Value</span>
                  <div className="font-mono font-semibold text-emerald-400">{String(activeStats.max)}</div>
                </div>
              </>
            )}
          </div>

          {/* Top 5 values breakdown */}
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1.5 block">
              Top Frequent Values
            </span>
            <div className="space-y-1.5">
              {activeStats.topValues.map((item) => (
                <div key={item.value} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span className="truncate max-w-[140px]" title={item.value}>
                      {item.value}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.percentage}%
                      </span>
                      {onApplyFilter && (
                        <div className="flex items-center space-x-0.5">
                          <button
                            onClick={() => onApplyFilter(activeStats.column, item.value, '=')}
                            className="p-0.5 rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-800"
                            title="Filter where equals"
                          >
                            <Filter className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={() => onApplyFilter(activeStats.column, item.value, '!=')}
                            className="p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                            title="Filter where not equals"
                          >
                            <FilterX className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded overflow-hidden">
                    <div className="bg-amber-400 h-full rounded" style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
