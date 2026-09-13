import * as duckdb from '@duckdb/duckdb-wasm';
import { getDuckDb, getDuckDbConnection } from './duckdbWorker';
import { IngestedFileRecord } from './types';

/**
 * Sanitizes a raw filename into a valid, readable SQL identifier.
 */
export function sanitizeTableName(fileName: string): string {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  let sanitized = baseName.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `t_${sanitized}`;
  }
  return sanitized || 'data_table';
}

/**
 * Detects the file format based on file name or MIME type.
 */
export function detectFormat(fileName: string): 'parquet' | 'csv' | 'json' | 'arrow' | 'unknown' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.parquet') || lower.endsWith('.pq')) return 'parquet';
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) return 'csv';
  if (lower.endsWith('.json') || lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) return 'json';
  if (lower.endsWith('.arrow') || lower.endsWith('.feather')) return 'arrow';
  return 'unknown';
}

/**
 * Ingests a local File object into DuckDB's virtual filesystem and registers an analytical view.
 */
export async function ingestFile(file: File): Promise<IngestedFileRecord> {
  const db = await getDuckDb();
  const conn = await getDuckDbConnection();
  const format = detectFormat(file.name);
  const virtualName = `file_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const tableName = sanitizeTableName(file.name);

  // Register the file handle in DuckDB's virtual file system
  await db.registerFileHandle(
    virtualName,
    file,
    duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
    true
  );

  let createSql = '';
  if (format === 'parquet') {
    createSql = `CREATE OR REPLACE VIEW "${tableName}" AS SELECT * FROM read_parquet('${virtualName}');`;
  } else if (format === 'csv') {
    createSql = `CREATE OR REPLACE VIEW "${tableName}" AS SELECT * FROM read_csv_auto('${virtualName}');`;
  } else if (format === 'json') {
    createSql = `CREATE OR REPLACE VIEW "${tableName}" AS SELECT * FROM read_json_auto('${virtualName}');`;
  } else if (format === 'arrow') {
    createSql = `CREATE OR REPLACE VIEW "${tableName}" AS SELECT * FROM scan_arrow_ipc('${virtualName}');`;
  } else {
    // Attempt CSV auto-detection by default
    createSql = `CREATE OR REPLACE VIEW "${tableName}" AS SELECT * FROM read_csv_auto('${virtualName}');`;
  }

  await conn.query(createSql);

  return {
    name: file.name,
    size: file.size,
    format,
    tableName,
    loadedAt: Date.now(),
  };
}

/**
 * Loads a remote sample file (e.g. from /samples/) into DuckDB virtual filesystem.
 */
export async function loadSampleDataset(url: string, fileName: string): Promise<IngestedFileRecord> {
  const db = await getDuckDb();
  const conn = await getDuckDbConnection();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load sample dataset from ${url} (${response.statusText})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const virtualName = `sample_${fileName}`;
  const tableName = sanitizeTableName(fileName);
  const format = detectFormat(fileName);

  await db.registerFileBuffer(virtualName, uint8Array);

  let createSql = '';
  if (format === 'parquet') {
    createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_parquet('${virtualName}');`;
  } else if (format === 'csv') {
    createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${virtualName}');`;
  } else if (format === 'json') {
    createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${virtualName}');`;
  } else {
    createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${virtualName}');`;
  }

  await conn.query(createSql);

  return {
    name: fileName,
    size: uint8Array.byteLength,
    format,
    tableName,
    loadedAt: Date.now(),
  };
}
