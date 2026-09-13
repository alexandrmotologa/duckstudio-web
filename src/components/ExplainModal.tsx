import React from 'react';
import { X, Network, Clock, Copy, Check } from 'lucide-react';
import { ExplainResult } from '../engine/types';

interface ExplainModalProps {
  explainResult: ExplainResult;
  onClose: () => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const ExplainModal: React.FC<ExplainModalProps> = ({ explainResult, onClose, onNotify }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(explainResult.planText);
    setCopied(true);
    onNotify('Copied EXPLAIN plan to clipboard.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-slate-800 px-5 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Query Execution Plan (EXPLAIN)</h3>
              <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span className="font-mono">{explainResult.executionTimeMs} ms plan time</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Plan</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 bg-[#0B0F17] flex flex-col space-y-4">
          <div>
            <span className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">
              Evaluated Query
            </span>
            <pre className="font-mono text-xs text-amber-300 bg-slate-950/70 p-3 rounded-lg border border-slate-800 mt-1 whitespace-pre-wrap">
              {explainResult.query}
            </pre>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <span className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider mb-1">
              Physical Execution Tree
            </span>
            <div className="flex-1 overflow-auto bg-slate-950/90 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre select-text">
              {explainResult.planText || 'No plan text returned from DuckDB.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
