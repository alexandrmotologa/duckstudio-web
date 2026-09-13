import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDuckDb,
  getDuckDbConnection,
  onEngineStatusChange,
  EngineStatus,
} from '../engine/duckdbWorker';
import {
  executeQuery,
  fetchCatalogTables,
} from '../engine/queryExecutor';
import { ingestFile, loadSampleDataset } from '../engine/fileLoader';
import {
  QueryResult,
  TableSchema,
  QueryHistoryItem,
  EditorTab,
  IngestedFileRecord,
} from '../engine/types';

const STORAGE_KEY_HISTORY = 'duckstudio_query_history_v1';
const STORAGE_KEY_TABS = 'duckstudio_editor_tabs_v1';

const INITIAL_QUERY = `-- Welcome to DuckStudio Web!
-- Run analytical SQL on Parquet, CSV, and JSON files inside your browser.
-- 100% Client-Side WebAssembly. Zero bytes leave your machine.

SELECT 
  product_category,
  count(*) AS total_orders,
  sum(units) AS total_units_sold,
  round(sum(total_amount), 2) AS total_revenue,
  round(avg(unit_price), 2) AS avg_item_price
FROM ecommerce_orders
GROUP BY product_category
ORDER BY total_revenue DESC;
`;

export function useDuckDb() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('uninitialized');
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [tabs, setTabs] = useState<EditorTab[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TABS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [{ id: 'tab-1', title: 'Analysis 1', query: INITIAL_QUERY }];
  });

  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });
  const [ingestedFiles, setIngestedFiles] = useState<IngestedFileRecord[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const initAttempted = useRef(false);

  // Sync tabs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(tabs));
    } catch {
      // ignore
    }
  }, [tabs]);

  // Sync history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 100)));
    } catch {
      // ignore
    }
  }, [history]);

  const showNotification = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  }, []);

  const refreshTables = useCallback(async () => {
    const list = await fetchCatalogTables();
    setTables(list);
  }, []);

  // Initialize engine and automatically load sample dataset
  useEffect(() => {
    const unsubscribe = onEngineStatusChange(setEngineStatus);

    if (!initAttempted.current) {
      initAttempted.current = true;
      (async () => {
        try {
          await getDuckDb();
          await getDuckDbConnection();
          // Load default sample dataset
          await loadSampleDataset('/samples/ecommerce_orders.csv', 'ecommerce_orders.csv');
          await loadSampleDataset('/samples/github_repositories.json', 'github_repositories.json');
          await refreshTables();
          showNotification('DuckDB-Wasm engine ready. Sample datasets loaded.', 'success');
        } catch (err) {
          console.error('Initial setup error:', err);
          showNotification('DuckDB-Wasm initialization failed. Check browser WebAssembly support.', 'error');
        }
      })();
    }

    return () => {
      unsubscribe();
    };
  }, [refreshTables, showNotification]);

  // Execute query handler
  const runQuery = useCallback(
    async (sqlToRun?: string) => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      const query = (sqlToRun ?? activeTab?.query ?? '').trim();

      if (!query) {
        showNotification('Query is empty.', 'info');
        return;
      }

      setIsExecuting(true);
      try {
        const result = await executeQuery(query);
        setQueryResult(result);

        const historyItem: QueryHistoryItem = {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          query,
          timestamp: result.timestamp,
          executionTimeMs: result.executionTimeMs,
          rowCount: result.rowCount,
          status: result.error ? 'error' : 'success',
          error: result.error,
        };

        setHistory((prev) => [historyItem, ...prev.slice(0, 99)]);

        if (result.error) {
          showNotification(`Query failed: ${result.error}`, 'error');
        } else {
          // If query modified catalog (e.g. CREATE, DROP), refresh tables
          if (/create|drop|alter|insert|delete|attach/i.test(query)) {
            await refreshTables();
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        showNotification(`Execution error: ${msg}`, 'error');
      } finally {
        setIsExecuting(false);
      }
    },
    [tabs, activeTabId, refreshTables, showNotification]
  );

  // File ingestion handler
  const handleDropFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileList = Array.from(files);
      if (!fileList.length) return;

      showNotification(`Ingesting ${fileList.length} file(s) into DuckDB...`, 'info');

      for (const file of fileList) {
        try {
          const records = await ingestFile(file);
          setIngestedFiles((prev) => [...records, ...prev]);
          const tableNames = records.map((r) => r.tableName).join(', ');
          showNotification(`Registered table(s) "${tableNames}" from ${file.name}`, 'success');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          showNotification(`Failed to ingest ${file.name}: ${msg}`, 'error');
        }
      }

      await refreshTables();
    },
    [refreshTables, showNotification]
  );

  // Tab management
  const updateActiveTabQuery = useCallback((query: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === activeTabId ? { ...tab, query } : tab))
    );
  }, [activeTabId]);

  const addTab = useCallback(() => {
    const newId = `tab-${Date.now()}`;
    const newIndex = tabs.length + 1;
    const newTab: EditorTab = {
      id: newId,
      title: `Query ${newIndex}`,
      query: `SELECT * FROM ecommerce_orders LIMIT 25;`,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  }, [tabs]);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((t) => t.id !== id);
      return filtered;
    });
    setActiveTabId((current) => {
      if (current === id) {
        const remaining = tabs.filter((t) => t.id !== id);
        return remaining[remaining.length - 1]?.id ?? 'tab-1';
      }
      return current;
    });
  }, [tabs]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch {
      // ignore
    }
  }, []);

  return {
    engineStatus,
    tables,
    tabs,
    activeTabId,
    activeTab: tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    queryResult,
    isExecuting,
    history,
    ingestedFiles,
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
  };
}
