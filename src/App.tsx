import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDuckDb } from './hooks/useDuckDb';
import { StudioHeader } from './components/StudioHeader';
import { SchemaSidebar } from './components/SchemaSidebar';
import { SqlEditor } from './components/SqlEditor';
import { DataGrid } from './components/DataGrid';
import { VisualizerModal } from './components/VisualizerModal';
import { QueryHistoryModal } from './components/QueryHistoryModal';
import { RemoteUrlModal } from './components/RemoteUrlModal';
import { ExplainModal } from './components/ExplainModal';
import { loadSampleDataset, ingestRemoteUrl } from './engine/fileLoader';
import { explainQuery } from './engine/queryExecutor';
import { ExplainResult } from './engine/types';
import {
  PanelLeftClose,
  PanelLeftOpen,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Info,
  Maximize2,
  Minimize2,
  GripHorizontal
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
  const [remoteUrlOpen, setRemoteUrlOpen] = useState(false);
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(null);

  // Split-pane resizing state
  const [editorHeightPercent, setEditorHeightPercent] = useState<number>(45);
  const [isMaximized, setIsMaximized] = useState<'editor' | 'grid' | null>(null);
  const isDraggingSplitter = useRef(false);
  const mainWorkspaceRef = useRef<HTMLDivElement>(null);

  const [isWindowDragOver, setIsWindowDragOver] = useState(false);

  // Drag handle between SQL Editor and DataGrid
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplitter.current = true;
    document.body.style.cursor = 'row-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplitter.current || !mainWorkspaceRef.current) return;
      const rect = mainWorkspaceRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const totalHeight = rect.height;
      let newPercent = (relativeY / totalHeight) * 100;
      if (newPercent < 15) newPercent = 15;
      if (newPercent > 85) newPercent = 85;
      setEditorHeightPercent(newPercent);
      setIsMaximized(null);
    };

    const handleMouseUp = () => {
      if (isDraggingSplitter.current) {
        isDraggingSplitter.current = false;
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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
        const sql = `SELECT product_category, count(*) AS orders, sum(total_amount) AS revenue FROM ecommerce_orders GROUP BY 1 ORDER BY revenue DESC;`;
        updateActiveTabQuery(sql);
        runQuery(sql);
      } else if (sampleName === 'github_repositories.json') {
        const sql = `SELECT repo, language, stars, forks FROM github_repositories ORDER BY stars DESC;`;
        updateActiveTabQuery(sql);
        runQuery(sql);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(`Failed to load sample: ${msg}`, 'error');
    }
  };

  const handleLoadRemoteUrl = async (url: string, customTableName?: string) => {
    showNotification(`Fetching remote dataset from ${url}...`, 'info');
    const record = await ingestRemoteUrl(url, customTableName);
    await refreshTables();
    showNotification(`Registered table "${record.tableName}" from remote URL`, 'success');
    const sql = `SELECT * FROM "${record.tableName}" LIMIT 25;`;
    updateActiveTabQuery(sql);
    runQuery(sql);
  };

  const handleExplainQuery = async (sqlToExplain: string) => {
    showNotification('Running EXPLAIN on query plan...', 'info');
    try {
      const res = await explainQuery(sqlToExplain);
      setExplainResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(`Explain failed: ${msg}`, 'error');
    }
  };

  const handleApplyFilter = useCallback(
    (col: string, val: string, op: '=' | '!=') => {
      const current = activeTab.query.trim();
      const escapedVal = val.replace(/'/g, "''");
      const filterClause = `"${col}" ${op} '${escapedVal}'`;

      let newQuery = '';
      if (/WHERE/i.test(current)) {
        newQuery = `${current} AND ${filterClause}`;
      } else if (/GROUP BY/i.test(current)) {
        newQuery = current.replace(/GROUP BY/i, `WHERE ${filterClause}\nGROUP BY`);
      } else if (/ORDER BY/i.test(current)) {
        newQuery = current.replace(/ORDER BY/i, `WHERE ${filterClause}\nORDER BY`);
      } else if (/LIMIT/i.test(current)) {
        newQuery = current.replace(/LIMIT/i, `WHERE ${filterClause}\nLIMIT`);
      } else {
        newQuery = `${current.replace(/;+\s*$/, '')}\nWHERE ${filterClause};`;
      }

      updateActiveTabQuery(newQuery);
      runQuery(newQuery);
      showNotification(`Applied filter: ${filterClause}`, 'info');
    },
    [activeTab.query, updateActiveTabQuery, runQuery, showNotification]
  );

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
        onOpenRemoteUrl={() => setRemoteUrlOpen(true)}
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
        <main ref={mainWorkspaceRef} className="flex-1 flex flex-col overflow-hidden bg-[#0D131F] relative">
          {/* Top Half: SQL Editor */}
          {isMaximized !== 'grid' && (
            <div
              style={{
                height: isMaximized === 'editor' ? '100%' : `${editorHeightPercent}%`,
              }}
              className="min-h-[120px] flex flex-col relative"
            >
              <SqlEditor
                tabs={tabs}
                activeTabId={activeTabId}
                tables={tables}
                onSelectTab={setActiveTabId}
                onAddTab={addTab}
                onCloseTab={closeTab}
                query={activeTab.query}
                onChangeQuery={updateActiveTabQuery}
                onRunQuery={(selected) => runQuery(selected)}
                onExplainQuery={handleExplainQuery}
                isExecuting={isExecuting}
              />

              {/* Maximize Editor Button */}
              <button
                onClick={() => setIsMaximized(isMaximized === 'editor' ? null : 'editor')}
                className="absolute right-3 top-2.5 z-10 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title={isMaximized === 'editor' ? 'Restore Split' : 'Maximize Editor'}
              >
                {isMaximized === 'editor' ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </button>
            </div>
          )}

          {/* Draggable Splitter Bar */}
          {isMaximized === null && (
            <div
              onMouseDown={handleSplitterMouseDown}
              className="h-2 bg-[#0B0F17] hover:bg-amber-500/40 cursor-row-resize flex items-center justify-center border-y border-slate-800 select-none group transition-colors z-10"
              title="Drag up or down to resize panels"
            >
              <div className="w-12 h-1 rounded-full bg-slate-700 group-hover:bg-amber-400 flex items-center justify-center transition-colors">
                <GripHorizontal className="w-3 h-3 text-slate-400 group-hover:text-amber-300" />
              </div>
            </div>
          )}

          {/* Bottom Half: Results DataGrid */}
          {isMaximized !== 'editor' && (
            <div
              style={{
                height: isMaximized === 'grid' ? '100%' : `${100 - editorHeightPercent}%`,
              }}
              className="min-h-[140px] overflow-hidden flex flex-col bg-[#0B0F17] relative"
            >
              <DataGrid
                result={queryResult}
                isExecuting={isExecuting}
                onOpenVisualizer={() => setVisualizerOpen(true)}
                onApplyFilter={handleApplyFilter}
                onNotify={showNotification}
              />

              {/* Maximize DataGrid Button */}
              <button
                onClick={() => setIsMaximized(isMaximized === 'grid' ? null : 'grid')}
                className="absolute right-3 bottom-3 z-10 p-1 rounded bg-slate-900/80 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors shadow"
                title={isMaximized === 'grid' ? 'Restore Split' : 'Maximize DataGrid'}
              >
                {isMaximized === 'grid' ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Full-screen Drag Overlay */}
      {isWindowDragOver && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md border-4 border-dashed border-amber-400 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-150">
          <FileSpreadsheet className="w-16 h-16 text-amber-400 animate-bounce mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Drop Data Files to Query</h2>
          <p className="text-sm text-slate-300 max-w-md leading-relaxed">
            Release your <span className="font-mono text-amber-400">.parquet</span>,{' '}
            <span className="font-mono text-amber-400">.csv</span>,{' '}
            <span className="font-mono text-amber-400">.xlsx</span>, or{' '}
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

      {/* Remote URL Modal */}
      {remoteUrlOpen && (
        <RemoteUrlModal
          onLoadUrl={handleLoadRemoteUrl}
          onClose={() => setRemoteUrlOpen(false)}
        />
      )}

      {/* Explain Plan Modal */}
      {explainResult && (
        <ExplainModal
          explainResult={explainResult}
          onClose={() => setExplainResult(null)}
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
