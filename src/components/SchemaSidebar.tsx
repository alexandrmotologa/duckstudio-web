import React, { useState } from 'react';
import {
  Table,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  Binary,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  Trash2,
  Copy,
  Layers,
  Check
} from 'lucide-react';
import { TableSchema, ColumnMeta } from '../engine/types';

interface SchemaSidebarProps {
  tables: TableSchema[];
  onRefresh: () => void;
  onSelectQuery: (sql: string) => void;
  onDropFiles: (files: FileList | File[]) => void;
  onDropTable?: (tableName: string, isView: boolean) => void;
  onNotify?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const SchemaSidebar: React.FC<SchemaSidebarProps> = ({
  tables,
  onRefresh,
  onSelectQuery,
  onDropFiles,
  onDropTable,
  onNotify,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [tableToDrop, setTableToDrop] = useState<{ name: string; isView: boolean } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [tableName]: !prev[tableName],
    }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files);
    }
  };

  const handleCopy = async (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onNotify?.(`Copied "${text}" to clipboard`, 'info');
    setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1800);
  };

  const filteredTables = tables.filter((table) => {
    const matchTableName = table.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchColumns = table.columns.some((col) =>
      col.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return matchTableName || matchColumns;
  });

  const getColumnIcon = (typeStr: string) => {
    const lower = typeStr.toLowerCase();
    if (lower.includes('int') || lower.includes('double') || lower.includes('float') || lower.includes('decimal') || lower.includes('numeric')) {
      return <Hash className="w-3 h-3 text-emerald-400 shrink-0" />;
    }
    if (lower.includes('date') || lower.includes('time')) {
      return <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />;
    }
    if (lower.includes('bool')) {
      return <ToggleLeft className="w-3 h-3 text-purple-400 shrink-0" />;
    }
    return <Type className="w-3 h-3 text-amber-400 shrink-0" />;
  };

  const totalRowCount = tables.reduce((acc, t) => acc + (t.rowCount ?? 0), 0);

  return (
    <aside
      className={`w-72 bg-[#0B0F17] border-r border-slate-800 flex flex-col select-none transition-colors ${
        isDragOver ? 'border-amber-500 bg-amber-500/5' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Sidebar Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Table className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Catalog Schema
          </span>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
            {tables.length}
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Refresh schema"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Summary Mini Bar */}
      {tables.length > 0 && (
        <div className="px-3 py-1.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="flex items-center space-x-1">
            <Layers className="w-3 h-3 text-slate-500" />
            <span>{tables.length} {tables.length === 1 ? 'table' : 'tables'}</span>
          </span>
          <span className="text-slate-300">{totalRowCount.toLocaleString()} rows total</span>
        </div>
      )}

      {/* Search Input */}
      <div className="p-2 border-b border-slate-800/80">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search tables & columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-900/90 text-slate-200 text-xs rounded border border-slate-800 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredTables.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-500 text-xs">
            {searchTerm ? (
              <p>No tables matching "{searchTerm}"</p>
            ) : (
              <div className="space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="font-medium text-slate-400">No tables loaded</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Drag and drop <span className="text-amber-400 font-mono">.parquet</span>,{' '}
                  <span className="text-amber-400 font-mono">.csv</span> or{' '}
                  <span className="text-amber-400 font-mono">.json</span> files here.
                </p>
              </div>
            )}
          </div>
        ) : (
          filteredTables.map((table) => {
            const isExpanded = !!expandedTables[table.name];
            const isView = table.type === 'VIEW';

            return (
              <div
                key={table.name}
                className="rounded border border-slate-800/60 bg-slate-900/50 overflow-hidden text-xs"
              >
                {/* Table Header Row */}
                <div
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-800/70 cursor-pointer group transition-colors"
                  onClick={() => toggleTable(table.name)}
                >
                  <div className="flex items-center space-x-1.5 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className="font-medium text-slate-200 truncate group-hover:text-amber-300" title={table.name}>
                      {table.name}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {table.rowCount !== undefined ? `${table.rowCount.toLocaleString()}r` : ''}
                    </span>
                    <button
                      onClick={(e) => handleCopy(`"${table.name}"`, `tbl_${table.name}`, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-white"
                      title="Copy table name"
                    >
                      {copiedKey === `tbl_${table.name}` ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Hover Quick Actions */}
                <div className="px-2 py-1 bg-slate-950/40 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectQuery(`SELECT * FROM "${table.name}" LIMIT 50;`);
                      }}
                      className="hover:text-amber-400 px-1 py-0.5 rounded hover:bg-slate-800 flex items-center space-x-0.5"
                      title="Preview top 50 rows"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectQuery(`SUMMARIZE "${table.name}";`);
                      }}
                      className="hover:text-amber-400 px-1 py-0.5 rounded hover:bg-slate-800 flex items-center space-x-0.5"
                      title="Run DuckDB SUMMARIZE statistics"
                    >
                      <Binary className="w-3 h-3" />
                      <span>Summarize</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectQuery(`SELECT count(*) AS total_rows FROM "${table.name}";`);
                      }}
                      className="hover:text-amber-400 px-1 py-0.5 rounded hover:bg-slate-800 flex items-center space-x-0.5"
                      title="Count total rows"
                    >
                      <Hash className="w-3 h-3" />
                      <span>Count</span>
                    </button>
                  </div>

                  {onDropTable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTableToDrop({ name: table.name, isView });
                      }}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Drop table from DuckDB memory"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Columns Tree */}
                {isExpanded && (
                  <div className="px-3 py-1.5 bg-slate-950/70 border-t border-slate-800/40 space-y-1">
                    {table.columns.map((col: ColumnMeta) => (
                      <div
                        key={col.name}
                        onClick={() => onSelectQuery(`SELECT "${col.name}", count(*) AS count FROM "${table.name}" GROUP BY 1 ORDER BY count DESC LIMIT 20;`)}
                        className="flex items-center justify-between text-[11px] text-slate-300 hover:text-amber-300 cursor-pointer py-0.5 group/col"
                        title="Click to query column value distribution"
                      >
                        <div className="flex items-center space-x-1.5 truncate">
                          {getColumnIcon(col.type)}
                          <span className="truncate">{col.name}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[80px]">
                            {col.type}
                          </span>
                          <button
                            onClick={(e) => handleCopy(`"${col.name}"`, `col_${table.name}_${col.name}`, e)}
                            className="opacity-0 group-hover/col:opacity-100 p-0.5 text-slate-500 hover:text-white"
                            title="Copy column name"
                          >
                            {copiedKey === `col_${table.name}_${col.name}` ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Drag & Drop Visual Indicator */}
      <div
        className={`m-2 p-3 rounded border border-dashed text-center transition-all ${
          isDragOver
            ? 'border-amber-400 bg-amber-400/10 text-amber-300'
            : 'border-slate-800 text-slate-500 bg-slate-900/30'
        }`}
      >
        <p className="text-[11px] font-medium">Drop Data Files</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Parquet • CSV • JSON • Arrow • Excel</p>
      </div>

      {/* Drop Table Confirmation Modal */}
      {tableToDrop && onDropTable && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 max-w-sm w-full text-xs animate-in zoom-in-95 duration-150">
            <h4 className="text-sm font-semibold text-white mb-1.5 flex items-center space-x-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Drop {tableToDrop.isView ? 'View' : 'Table'}?</span>
            </h4>
            <p className="text-slate-300 mb-4 leading-relaxed">
              Are you sure you want to drop <span className="font-mono text-amber-400">"{tableToDrop.name}"</span>? This will free allocated in-memory buffers in DuckDB-Wasm.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setTableToDrop(null)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDropTable(tableToDrop.name, tableToDrop.isView);
                  setTableToDrop(null);
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 font-semibold text-white shadow"
              >
                Confirm Drop
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
