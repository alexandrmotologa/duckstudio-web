import React from 'react';
import { X, Keyboard, ShieldCheck, Cpu, Zap } from 'lucide-react';
import { DuckDbEngineInfo } from '../engine/types';

interface ShortcutsModalProps {
  engineInfo: DuckDbEngineInfo | null;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Ctrl + Enter / ⌘ + Enter', desc: 'Execute current SQL query or selected lines' },
  { key: 'Shift + Alt + F', desc: 'Format and beautify SQL with keyword capitalization' },
  { key: 'Ctrl + Space', desc: 'Trigger schema autocomplete suggestions' },
  { key: 'Double-Click Tab', desc: 'Rename the active editor query tab' },
  { key: 'Click Row Number', desc: 'Open row export menu (Copy as JSON / CSV)' },
  { key: 'Click Column Header Bar', desc: 'Open instant statistical profiling popover' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ engineInfo, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-14 border-b border-slate-800 px-5 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Shortcuts & Engine Overview</h3>
              <p className="text-[11px] text-slate-400">
                Productivity shortcuts and DuckDB WebAssembly details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 text-xs">
          {/* Shortcuts Table */}
          <div>
            <h4 className="font-semibold text-slate-200 mb-2.5 flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Keyboard Shortcuts</span>
            </h4>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/80 overflow-hidden">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-300">{s.desc}</span>
                  <kbd className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono text-[11px] shadow-sm">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* DuckDB Engine System Info */}
          <div>
            <h4 className="font-semibold text-slate-200 mb-2.5 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>DuckDB-Wasm Engine Status</span>
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Engine Version</span>
                <div className="font-mono font-bold text-cyan-400 mt-1 truncate" title={engineInfo?.version || 'DuckDB-Wasm'}>
                  {engineInfo?.version || 'DuckDB-Wasm'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Tables</span>
                <div className="font-mono font-bold text-amber-400 mt-1">
                  {engineInfo?.tableCount ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Rows in Memory</span>
                <div className="font-mono font-bold text-emerald-400 mt-1">
                  {engineInfo?.totalRows.toLocaleString() ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-200/90 leading-relaxed">
              <span className="font-semibold text-emerald-300 block mb-0.5">100% Client-Side WebAssembly Privacy</span>
              All files, queries, and analytical operations run strictly within your browser's Web Worker memory. Zero bytes or sensitive records ever leave your computer.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 border-t border-slate-800 px-5 flex items-center justify-end bg-slate-900/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
