import React, { useState } from 'react';
import { useDuckDb } from './hooks/useDuckDb';
import { StudioHeader } from './components/StudioHeader';
import { SchemaSidebar } from './components/SchemaSidebar';
import { SqlEditor } from './components/SqlEditor';
import { DataGrid } from './components/DataGrid';
import { VisualizerModal } from './components/VisualizerModal';
import { QueryHistoryModal } from './components/QueryHistoryModal';
import { loadSampleDataset } from './engine/fileLoader';
import {
  PanelLeftClose,
  PanelLeftOpen,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Info
} from 'lucide-react';

export const App: React.FC = () => {
  const {
    engineStatus,
    tables,
    tabs,
    activeTabId,
    activeTab,
    queryResult,
    isExecuting,
    history,
    notification,
    setActiveTabId,
    updateActiveTabQuery,
    addTab,
    closeTab,
    runQuery,
    refreshTables,
    handleDropFiles,
    clearHistory,
    showNotification,
  } = useDuckDb();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [visualizerOpen, setVisualizerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);

  // Global window drag & drop handler
  const handleWindowDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsWindowDragOver(true);
  };

  const handleWindowDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsWindowDragOver(false);
  };

  const handleWindowDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsWindowDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleDropFiles(e.dataTransfer.files);
    }
  };

  const handleLoadSample = async (sampleName: string) => {
    showNotification(`Loading sample ${sampleName}...`, 'info');
    try {
      await loadSampleDataset(`/samples/${sampleName}`, sampleName);
      await refreshTables();
      showNotification(`Sample ${sampleName} loaded successfully.`, 'success');
      if (sampleName === 'ecommerce_orders.csv') {
        updateActiveTabQuery(`SELECT product_category, count(*) AS orders, sum(total_amount) AS revenue FROM ecommerce_orders GROUP BY 1 ORDER BY revenue DESC;`);
        runQuery(`SELECT product_category, count(*) AS orders, sum(total_amount) AS revenue FROM ecommerce_orders GROUP BY 1 ORDER BY revenue DESC;`);
      } else if (sampleName === 'github_repositories.json') {
        updateActiveTabQuery(`SELECT repo, language, stars, forks FROM github_repositories ORDER BY stars DESC;`);
        runQuery(`SELECT repo, language, stars, forks FROM github_repositories ORDER BY stars DESC;`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(`Failed to load sample: ${msg}`, 'error');
    }
  };

  return (
    <div
      className="h-screen w-screen flex flex-col bg-[#0B0F17] text-slate-100 relative overflow-hidden"
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
    >
      {/* Top Header */}
      <StudioHeader
        engineStatus={engineStatus}
        isExecuting={isExecuting}
        onRunQuery={() => runQuery()}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenVisualizer={() => setVisualizerOpen(true)}
        onDropFiles={handleDropFiles}
        onLoadSample={handleLoadSample}
        hasResults={!!queryResult && !queryResult.error && queryResult.rowCount > 0}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-2 bottom-3 z-20 p-1.5 rounded-md bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 shadow-md transition-colors"
          title={sidebarOpen ? 'Collapse Catalog' : 'Expand Catalog'}
        >
          {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
        </button>

        {/* Catalog Schema Sidebar */}
        {sidebarOpen && (
          <SchemaSidebar
            tables={tables}
            onRefresh={refreshTables}
            onSelectQuery={(sql) => {
              updateActiveTabQuery(sql);
              runQuery(sql);
            }}
            onDropFiles={handleDropFiles}
          />
        )}

        {/* Right Studio Panes (Editor + Grid) */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0D131F]">
          {/* Top Half: SQL Editor */}
          <div className="h-[42%] min-h-[160px] border-b border-slate-800 flex flex-col">
            <SqlEditor
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={setActiveTabId}
              onAddTab={addTab}
              onCloseTab={closeTab}
              query={activeTab.query}
              onChangeQuery={updateActiveTabQuery}
              onRunQuery={() => runQuery()}
              isExecuting={isExecuting}
            />
          </div>

          {/* Bottom Half: Results DataGrid */}
          <div className="flex-1 min-h-[180px] overflow-hidden flex flex-col bg-[#0B0F17]">
            <DataGrid
              result={queryResult}
              isExecuting={isExecuting}
              onOpenVisualizer={() => setVisualizerOpen(true)}
              onNotify={showNotification}
            />
          </div>
        </main>
      </div>

      {/* Full-screen Drag Overlay */}
      {isWindowDragOver && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md border-4 border-dashed border-amber-400 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-150">
          <FileSpreadsheet className="w-16 h-16 text-amber-400 animate-bounce mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Drop Data Files to Query</h2>
          <p className="text-sm text-slate-300 max-w-md leading-relaxed">
            Release your <span className="font-mono text-amber-400">.parquet</span>,{' '}
            <span className="font-mono text-amber-400">.csv</span>, or{' '}
            <span className="font-mono text-amber-400">.json</span> files.
            DuckDB-Wasm will parse them instantly in-memory. Zero bytes leave your browser.
          </p>
        </div>
      )}

      {/* Visualizer Modal */}
      {visualizerOpen && queryResult && (
        <VisualizerModal
          result={queryResult}
          onClose={() => setVisualizerOpen(false)}
        />
      )}

      {/* Query History Modal */}
      {historyOpen && (
        <QueryHistoryModal
          history={history}
          onSelectQuery={(sql) => {
            updateActiveTabQuery(sql);
            runQuery(sql);
          }}
          onClearHistory={clearHistory}
          onClose={() => setHistoryOpen(false)}
          onNotify={showNotification}
        />
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center space-x-2 px-3.5 py-2 rounded-lg shadow-xl border text-xs font-medium bg-slate-900 border-slate-700 animate-in slide-in-from-bottom-2 duration-200">
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span className="text-slate-200">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
