import * as duckdb from '@duckdb/duckdb-wasm';

let dbInstance: duckdb.AsyncDuckDB | null = null;
let dbConnection: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdb.AsyncDuckDB> | null = null;

export type EngineStatus = 'uninitialized' | 'initializing' | 'ready' | 'error';

let currentStatus: EngineStatus = 'uninitialized';
let statusListeners: Array<(status: EngineStatus) => void> = [];

export function getEngineStatus(): EngineStatus {
  return currentStatus;
}

export function onEngineStatusChange(listener: (status: EngineStatus) => void): () => void {
  statusListeners.push(listener);
  listener(currentStatus);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

function updateStatus(status: EngineStatus) {
  currentStatus = status;
  statusListeners.forEach((l) => l(status));
}

/**
 * Initializes DuckDB-Wasm in a dedicated Web Worker.
 * Uses duckdb.getJsDelivrBundles() with automatic fallback.
 */
export async function getDuckDb(): Promise<duckdb.AsyncDuckDB> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  updateStatus('initializing');

  initPromise = (async () => {
    try {
      const bundles = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(bundles);

      if (!bundle.mainWorker) {
        throw new Error('No compatible DuckDB-Wasm worker bundle found for this browser.');
      }

      const worker = await duckdb.createWorker(bundle.mainWorker);
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      const db = new duckdb.AsyncDuckDB(logger, worker);

      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      dbInstance = db;
      updateStatus('ready');
      return db;
    } catch (error) {
      updateStatus('error');
      console.error('Failed to initialize DuckDB-Wasm:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Retrieves a reusable active DuckDB connection.
 */
export async function getDuckDbConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (dbConnection) return dbConnection;
  const db = await getDuckDb();
  dbConnection = await db.connect();
  return dbConnection;
}

/**
 * Resets the connection and releases allocated resources.
 */
export async function resetDuckDb(): Promise<void> {
  if (dbConnection) {
    await dbConnection.close();
    dbConnection = null;
  }
  if (dbInstance) {
    await dbInstance.terminate();
    dbInstance = null;
  }
  initPromise = null;
  updateStatus('uninitialized');
}
