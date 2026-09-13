import React, { useState } from 'react';
import { X, Globe, Download, Sparkles, Loader2 } from 'lucide-react';

interface RemoteUrlModalProps {
  onLoadUrl: (url: string, tableName?: string) => Promise<void>;
  onClose: () => void;
}

const PRESETS = [
  {
    title: 'HuggingFace Fineweb Parquet',
    url: 'https://huggingface.co/datasets/HuggingFaceFW/fineweb/resolve/main/sample/10BT/000_00000.parquet',
    tableName: 'fineweb_sample',
  },
  {
    title: 'World Bank Population (CSV)',
    url: 'https://raw.githubusercontent.com/datasets/population/master/data/population.csv',
    tableName: 'world_population',
  },
  {
    title: 'Crypto BTC/USD 1h Ticks (CSV)',
    url: 'https://raw.githubusercontent.com/ccxt/ccxt/master/examples/data/btc_usdt.csv',
    tableName: 'crypto_ticks',
  },
];

export const RemoteUrlModal: React.FC<RemoteUrlModalProps> = ({ onLoadUrl, onClose }) => {
  const [url, setUrl] = useState('');
  const [customTable, setCustomTable] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      await onLoadUrl(url.trim(), customTable.trim() || undefined);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (presetUrl: string, presetTable: string) => {
    setUrl(presetUrl);
    setCustomTable(presetTable);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-slate-800 px-5 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Load Remote Dataset</h3>
              <p className="text-[11px] text-slate-400">
                Query public Parquet, CSV, JSON, or Excel via HTTP/HTTPS
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

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Public File URL (Direct Download / CDN)
            </label>
            <input
              type="url"
              required
              placeholder="https://raw.githubusercontent.com/.../dataset.parquet"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg focus:outline-none focus:border-amber-500 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Custom Table Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. remote_sales"
              value={customTable}
              onChange={(e) => setCustomTable(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg focus:outline-none focus:border-amber-500 font-mono text-xs"
            />
          </div>

          {/* Quick Preset Badges */}
          <div>
            <div className="flex items-center space-x-1 text-slate-400 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-medium">Quick Presets</span>
            </div>
            <div className="space-y-1.5">
              {PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.title}
                  onClick={() => handleSelectPreset(preset.url, preset.tableName)}
                  className="w-full text-left p-2 rounded bg-slate-900/60 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-slate-300 transition-colors"
                >
                  <span className="font-medium">{preset.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{preset.tableName}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-rose-950/30 border border-rose-900/50 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className={`px-4 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 text-white transition-all ${
                isLoading || !url.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-md'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading Buffer...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Load Into DuckDB</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
