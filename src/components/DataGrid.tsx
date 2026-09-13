import React, { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Zap,
  BarChart2,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { QueryResult } from '../engine/types';
import { ExportDropdown } from './ExportDropdown';

interface DataGridProps {
  result: QueryResult | null;
  isExecuting: boolean;
  onOpenVisualizer: () => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

type SortDirection = 'asc' | 'desc' | null;

export const DataGrid: React.FC<DataGridProps> = ({
  result,
  isExecuting,
  onOpenVisualizer,
  onNotify,
}) => {
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

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

  // Virtualizer for smooth 60fps rendering
  const rowVirtualizer = useVirtualizer({
    count: processedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 15,
  });

  const handleCellClick = async (value: unknown) => {
    if (value === null || value === undefined) return;
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await navigator.clipboard.writeText(str);
    onNotify(`Copied "${str.slice(0, 30)}${str.length > 30 ? '...' : ''}"`, 'info');
  };

  // Render error message if query failed
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
          <div className="mt-3 text-[11px] text-slate-400">
            Check your table and column names in the Catalog Schema explorer on the left.
          </div>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isExecuting) {
    return (
      <div className="h-full flex flex-col bg-[#0B0F17] justify-center items-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <p className="text-xs text-slate-400 font-mono">Executing query in DuckDB Web Worker...</p>
      </div>
    );
  }

  // Render empty state
  if (!result || !result.columns.length) {
    return (
      <div className="h-full flex flex-col bg-[#0B0F17] justify-center items-center text-slate-500 text-xs">
        <Layers className="w-8 h-8 text-slate-700 mb-2" />
        <p className="font-medium text-slate-400">No query results</p>
        <p className="text-slate-500 mt-0.5">Press Run Query (Ctrl+Enter) to execute.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0B0F17] select-text">
      {/* Top Metrics & Action Bar */}
      <div className="h-10 bg-[#0F172A] border-b border-slate-800 px-3 flex items-center justify-between text-xs shrink-0 select-none">
        {/* Left Metrics */}
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
        </div>

        {/* Right Search & Actions */}
        <div className="flex items-center space-x-2">
          {/* Quick Filter Search */}
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2.5" />
            <input
              type="text"
              placeholder="Filter result rows..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-7 pr-2.5 py-1 bg-slate-900/90 text-slate-200 text-xs rounded border border-slate-700 focus:outline-none focus:border-amber-500/50 w-36 sm:w-48 transition-colors"
            />
          </div>

          {/* Visualize Button */}
          <button
            onClick={onOpenVisualizer}
            className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1 transition-colors"
            title="Create Visual Chart"
          >
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Visualize</span>
          </button>

          {/* Export Dropdown */}
          <ExportDropdown result={result} onNotify={onNotify} />
        </div>
      </div>

      {/* Grid Container */}
      <div ref={parentRef} className="flex-1 overflow-auto bg-[#0B0F17] relative">
        <table className="w-full text-left border-collapse text-xs font-mono">
          {/* Table Headers */}
          <thead className="sticky top-0 bg-[#111827] z-20 shadow-sm border-b border-slate-800">
            <tr>
              {/* Row index header */}
              <th className="w-12 px-2 py-2 text-center text-[10px] text-slate-500 font-semibold bg-[#0F172A] border-r border-slate-800 select-none">
                #
              </th>
              {result.columns.map((col) => {
                const isSorted = sortCol === col;
                const colType = result.columnTypes[col] || '';
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-3 py-2 text-slate-300 font-semibold cursor-pointer hover:bg-slate-800/80 transition-colors border-r border-slate-800/60 select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between space-x-2">
                      <span className="text-slate-100">{col}</span>
                      <div className="flex items-center space-x-1">
                        <span className="text-[9px] text-slate-400 font-normal px-1 py-0.5 rounded bg-slate-800">
                          {colType.length > 12 ? colType.slice(0, 10) + '..' : colType}
                        </span>
                        {isSorted ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-amber-400" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-amber-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-600 opacity-0 group-hover:opacity-100" />
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body (Virtualized) */}
          <tbody
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = processedRows[virtualRow.index];
              const rowIndex = virtualRow.index;
              return (
                <tr
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="table-row-hover border-b border-slate-900 absolute top-0 left-0 w-full flex items-center"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {/* Row index cell */}
                  <td className="w-12 px-2 py-1.5 text-center text-[10px] text-slate-600 bg-[#0E1522] border-r border-slate-800/80 select-none shrink-0">
                    {rowIndex + 1}
                  </td>
                  {result.columns.map((col) => {
                    const val = row[col];
                    const isNull = val === null || val === undefined;
                    const displayStr = isNull
                      ? 'null'
                      : typeof val === 'object'
                      ? JSON.stringify(val)
                      : String(val);

                    return (
                      <td
                        key={col}
                        onClick={() => handleCellClick(val)}
                        title="Click to copy value"
                        className={`px-3 py-1.5 border-r border-slate-900/80 truncate cursor-pointer flex-1 ${
                          isNull ? 'text-slate-600 italic' : 'text-slate-200'
                        }`}
                      >
                        {displayStr}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
