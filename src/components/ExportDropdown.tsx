import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileCode,
  FileText,
  Copy,
  Check,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { QueryResult } from '../engine/types';
import {
  convertRowsToCsv,
  convertRowsToMarkdown,
  exportQueryToParquet,
} from '../engine/queryExecutor';

interface ExportDropdownProps {
  result: QueryResult;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({ result, onNotify }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingParquet, setIsExportingParquet] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    try {
      const csvStr = convertRowsToCsv(result.columns, result.rows);
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `duckstudio_export_${Date.now()}.csv`);
      onNotify('Exported to CSV successfully.', 'success');
      setIsOpen(false);
    } catch {
      onNotify('Failed to export CSV.', 'error');
    }
  };

  const handleExportJson = () => {
    try {
      const jsonStr = JSON.stringify(result.rows, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      downloadBlob(blob, `duckstudio_export_${Date.now()}.json`);
      onNotify('Exported to JSON successfully.', 'success');
      setIsOpen(false);
    } catch {
      onNotify('Failed to export JSON.', 'error');
    }
  };

  const handleExportParquet = async () => {
    setIsExportingParquet(true);
    try {
      const buffer = await exportQueryToParquet(result.query);
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      downloadBlob(blob, `duckstudio_export_${Date.now()}.parquet`);
      onNotify('Exported to compressed Parquet successfully.', 'success');
      setIsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify(`Parquet export failed: ${msg}`, 'error');
    } finally {
      setIsExportingParquet(false);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const mdStr = convertRowsToMarkdown(result.columns, result.rows, 100);
      await navigator.clipboard.writeText(mdStr);
      setCopiedMd(true);
      onNotify('Copied Markdown table to clipboard.', 'success');
      setTimeout(() => setCopiedMd(false), 2000);
      setIsOpen(false);
    } catch {
      onNotify('Failed to copy Markdown to clipboard.', 'error');
    }
  };

  const handleCopyTsv = async () => {
    try {
      const header = result.columns.join('\t');
      const lines = result.rows.map((row) =>
        result.columns.map((col) => String(row[col] ?? '')).join('\t')
      );
      const tsvStr = [header, ...lines].join('\n');
      await navigator.clipboard.writeText(tsvStr);
      onNotify('Copied TSV to clipboard (ready to paste into Excel/Sheets).', 'success');
      setIsOpen(false);
    } catch {
      onNotify('Failed to copy TSV to clipboard.', 'error');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors"
        title="Export query results"
      >
        <Download className="w-3.5 h-3.5 text-amber-400" />
        <span>Export</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-52 rounded-md bg-slate-900 border border-slate-700 shadow-xl py-1 z-50 text-xs"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
            Download File
          </div>

          <button
            onClick={handleExportCsv}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download as CSV</span>
          </button>

          <button
            onClick={handleExportParquet}
            disabled={isExportingParquet}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
          >
            {isExportingParquet ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Download as Parquet</span>
          </button>

          <button
            onClick={handleExportJson}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Download as JSON</span>
          </button>

          <div className="border-t border-slate-800 my-1" />

          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Copy to Clipboard
          </div>

          <button
            onClick={handleCopyMarkdown}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
          >
            {copiedMd ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Copy as Markdown</span>
          </button>

          <button
            onClick={handleCopyTsv}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy as TSV (Excel)</span>
          </button>
        </div>
      )}
    </div>
  );
};
