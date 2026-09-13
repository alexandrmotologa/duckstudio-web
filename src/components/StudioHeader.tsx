import React, { useRef } from 'react';
import {
  UploadCloud,
  Database,
  BarChart2,
  History,
  ShieldCheck,
  Github,
  Play,
  Sparkles,
  ChevronDown,
  Globe
} from 'lucide-react';
import { EngineStatus } from '../engine/duckdbWorker';

interface StudioHeaderProps {
  engineStatus: EngineStatus;
  isExecuting: boolean;
  onRunQuery: () => void;
  onOpenHistory: () => void;
  onOpenVisualizer: () => void;
  onOpenRemoteUrl: () => void;
  onDropFiles: (files: FileList | File[]) => void;
  onLoadSample: (sampleName: string) => void;
  hasResults: boolean;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  engineStatus,
  isExecuting,
  onRunQuery,
  onOpenHistory,
  onOpenVisualizer,
  onOpenRemoteUrl,
  onDropFiles,
  onLoadSample,
  hasResults,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [samplesOpen, setSamplesOpen] = React.useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onDropFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <header className="h-14 bg-[#0F172A] border-b border-slate-800 px-4 flex items-center justify-between select-none z-30">
      {/* Brand Identity */}
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <svg className="w-6 h-6" viewBox="0 0 64 64" fill="none">
            <path
              d="M46 36C46 43.732 38.837 50 30 50C21.163 50 14 43.732 14 36C14 29.5 19.5 24 26 23.2V22C26 17.582 29.582 14 34 14C38.418 14 42 17.582 42 22C42 22.8 41.8 23.6 41.5 24.3C44.2 27.2 46 31.4 46 36Z"
              fill="#FBBF24"
            />
            <path
              d="M41 20H51C52.1 20 53 20.9 53 22C53 23.1 52.1 24 51 24H41.8C41.9 23.4 42 22.7 42 22C42 21.3 41.9 20.6 41 20Z"
              fill="#F97316"
            />
            <circle cx="37" cy="20" r="2.5" fill="#0F172A" />
            <path d="M18 42L25 37L32 41L42 31" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-100 text-base tracking-tight font-sans">
              DuckStudio<span className="text-amber-400 font-mono text-sm ml-1">Web</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20">
              WASM
            </span>
          </div>
        </div>

        {/* Engine Status Badge */}
        <div className="ml-2 pl-3 border-l border-slate-800 flex items-center space-x-1.5 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              engineStatus === 'ready'
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                : engineStatus === 'initializing'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-slate-400 font-mono text-[11px] capitalize">
            {engineStatus === 'ready' ? 'DuckDB Ready' : engineStatus}
          </span>
        </div>
      </div>

      {/* Center Controls: Run, Samples, Upload, Remote URL */}
      <div className="flex items-center space-x-2">
        {/* Execute Button */}
        <button
          onClick={onRunQuery}
          disabled={isExecuting || engineStatus !== 'ready'}
          className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all shadow-sm ${
            isExecuting || engineStatus !== 'ready'
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30 hover:shadow-emerald-900/50'
          }`}
          title="Execute Query or Selection (Ctrl + Enter / Cmd + Enter)"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isExecuting ? 'animate-spin' : ''}`} />
          <span>{isExecuting ? 'Running...' : 'Run Query'}</span>
          <span className="text-[10px] bg-emerald-700/60 px-1 py-0.2 rounded text-emerald-100 font-mono">
            Ctrl+↵
          </span>
        </button>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept=".parquet,.pq,.csv,.tsv,.json,.jsonl,.ndjson,.arrow,.feather,.xlsx,.xls"
          className="hidden"
        />

        {/* Upload File Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors"
          title="Open Parquet, CSV, JSON, Arrow, or Excel files"
        >
          <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
          <span>Import Files</span>
        </button>

        {/* Remote URL Button */}
        <button
          onClick={onOpenRemoteUrl}
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors"
          title="Query remote URL dataset via HTTP/HTTPS"
        >
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span>Remote URL</span>
        </button>

        {/* Sample Datasets Dropdown */}
        <div className="relative">
          <button
            onClick={() => setSamplesOpen(!samplesOpen)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Samples</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {samplesOpen && (
            <div
              className="absolute right-0 mt-1 w-56 rounded-md bg-slate-900 border border-slate-700 shadow-xl py-1 z-50 text-xs"
              onMouseLeave={() => setSamplesOpen(false)}
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                Bundled Datasets
              </div>
              <button
                onClick={() => {
                  onLoadSample('ecommerce_orders.csv');
                  setSamplesOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
              >
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <div>
                  <div className="font-medium">E-Commerce Orders</div>
                  <div className="text-[10px] text-slate-400">CSV • Multi-category transactions</div>
                </div>
              </button>
              <button
                onClick={() => {
                  onLoadSample('github_repositories.json');
                  setSamplesOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
              >
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <div>
                  <div className="font-medium">GitHub Top Repositories</div>
                  <div className="text-[10px] text-slate-400">JSON • Stars, forks & topics</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Actions: Privacy Indicator, Visualizer, History, GitHub */}
      <div className="flex items-center space-x-2">
        {/* Privacy Verified Badge */}
        <div
          className="hidden md:flex items-center space-x-1 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px]"
          title="Zero-Cloud Privacy: 100% of data is stored in memory in your browser. No data is sent over the network."
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium">Zero-Cloud Privacy</span>
        </div>

        {/* Visualizer Trigger */}
        <button
          onClick={onOpenVisualizer}
          disabled={!hasResults}
          className={`p-1.5 rounded-md text-xs font-medium border transition-colors flex items-center space-x-1 ${
            hasResults
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
          }`}
          title="Open Chart Visualizer"
        >
          <BarChart2 className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Chart</span>
        </button>

        {/* Query History Trigger */}
        <button
          onClick={onOpenHistory}
          className="p-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center space-x-1"
          title="Query History"
        >
          <History className="w-4 h-4 text-slate-400" />
          <span className="hidden sm:inline">History</span>
        </button>

        {/* GitHub Link */}
        <a
          href="https://github.com/alexandrmotologa/duckstudio-web"
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="View on GitHub"
        >
          <Github className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
};
