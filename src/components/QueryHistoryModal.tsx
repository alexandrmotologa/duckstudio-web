import React, { useState } from 'react';
import {
  X,
  History,
  Play,
  Copy,
  Trash2,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Search
} from 'lucide-react';
import { QueryHistoryItem } from '../engine/types';

interface QueryHistoryModalProps {
  history: QueryHistoryItem[];
  onSelectQuery: (sql: string) => void;
  onClearHistory: () => void;
  onClose: () => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const QueryHistoryModal: React.FC<QueryHistoryModalProps> = ({
  history,
  onSelectQuery,
  onClearHistory,
  onClose,
  onNotify,
}) => {
  const [filter, setFilter] = useState('');

  const filteredHistory = history.filter((item) =>
    item.query.toLowerCase().includes(filter.toLowerCase())
  );

  const handleCopy = async (sql: string) => {
    await navigator.clipboard.writeText(sql);
    onNotify('Copied SQL query to clipboard.', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="h-14 border-b border-slate-800 px-5 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Query History</h3>
              <p className="text-[11px] text-slate-400">
                {history.length} executed queries saved locally
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="px-2.5 py-1 rounded text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/50 flex items-center space-x-1 transition-colors"
                title="Clear all saved history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter search */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search query history..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 text-slate-200 text-xs rounded border border-slate-700 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* History Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <History className="w-8 h-8 mx-auto text-slate-700 mb-2" />
              <p className="font-medium text-slate-400">No matching query history</p>
              <p className="text-slate-500 mt-0.5">Executed queries will automatically appear here.</p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isSuccess = item.status === 'success';
              const dateStr = new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 flex flex-col space-y-2 hover:border-slate-700 transition-colors"
                >
                  {/* Meta header */}
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-2">
                      {isSuccess ? (
                        <span className="flex items-center space-x-1 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="font-medium">Success</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-rose-400">
                          <XCircle className="w-3.5 h-3.5" />
                          <span className="font-medium">Failed</span>
                        </span>
                      )}

                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400 font-mono">{dateStr}</span>
                    </div>

                    <div className="flex items-center space-x-3 text-slate-400 font-mono">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>{item.executionTimeMs} ms</span>
                      </span>

                      {isSuccess && (
                        <span className="flex items-center space-x-1">
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>{item.rowCount.toLocaleString()} rows</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SQL Content */}
                  <pre className="font-mono text-xs text-slate-200 bg-slate-950/80 p-2.5 rounded border border-slate-800/80 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-32">
                    {item.query}
                  </pre>

                  {/* Error if present */}
                  {item.error && (
                    <div className="text-[11px] text-rose-300 bg-rose-950/20 border border-rose-900/40 p-2 rounded font-mono">
                      {item.error}
                    </div>
                  )}

                  {/* Item Actions */}
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      onClick={() => handleCopy(item.query)}
                      className="px-2.5 py-1 rounded text-xs text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80 flex items-center space-x-1 transition-colors"
                      title="Copy SQL"
                    >
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectQuery(item.query);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1 transition-colors"
                      title="Load into Editor & Run"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Run Query</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
