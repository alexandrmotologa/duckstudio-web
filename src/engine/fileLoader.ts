import * as duckdb from '@duckdb/duckdb-wasm';
import * as XLSX from 'xlsx';
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
export function detectFormat(fileName: string): 'parquet' | 'csv' | 'json' | 'arrow' | 'excel' | 'unknown' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.parquet') || lower.endsWith('.pq')) return 'parquet';
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) return 'csv';
  if (lower.endsWith('.json') || lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) return 'json';
  if (lower.endsWith('.arrow') || lower.endsWith('.feather')) return 'arrow';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'excel';
  return 'unknown';
}

/**
 * Parses an Excel (.xlsx / .xls) buffer and ingests each sheet into DuckDB.
 */
export async function ingestExcelFile(file: File): Promise<IngestedFileRecord[]> {
  const db = await getDuckDb();
  const conn = await getDuckDbConnection();
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const records: IngestedFileRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    if (!csvContent.trim()) continue;

    const encoder = new TextEncoder();
    const csvBytes = encoder.encode(csvContent);
    const sanitizedSheet = sanitizeTableName(sheetName);
    const tableName = workbook.SheetNames.length === 1
      ? sanitizeTableName(file.name)
      : `${sanitizeTableName(file.name)}_${sanitizedSheet}`;
    const virtualName = `excel_${Date.now()}_${tableName}.csv`;

    await db.registerFileBuffer(virtualName, csvBytes);
    await conn.query(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${virtualName}');`);

    records.push({
      name: `${file.name} [${sheetName}]`,
      size: csvBytes.byteLength,
      format: 'excel',
      tableName,
      loadedAt: Date.now(),
    });
  }

  return records;
}

/**
 * Ingests a local File object into DuckDB's virtual filesystem and registers an analytical view.
 */
export async function ingestFile(file: File): Promise<IngestedFileRecord[]> {
  const format = detectFormat(file.name);

  if (format === 'excel') {
    return ingestExcelFile(file);
  }

  const db = await getDuckDb();
  const conn = await getDuckDbConnection();
  const virtualName = `file_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const tableName = sanitizeTableName(file.name);

  // Register file handle in DuckDB virtual filesystem
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
    createSql = `CREATE OR REPLACE VIEW "${tableName}" AS SELECT * FROM read_csv_auto('${virtualName}');`;
  }

  await conn.query(createSql);

  return [{
    name: file.name,
    size: file.size,
    format,
    tableName,
    loadedAt: Date.now(),
  }];
}

/**
 * Loads a remote URL (HTTP/HTTPS) and registers it as a DuckDB table.
 */
export async function ingestRemoteUrl(url: string, customTableName?: string): Promise<IngestedFileRecord> {
  const db = await getDuckDb();
  const conn = await getDuckDbConnection();

  const parsedUrl = new URL(url);
  const pathname = parsedUrl.pathname;
  const rawFileName = pathname.substring(pathname.lastIndexOf('/') + 1) || 'remote_data';
  const tableName = customTableName ? sanitizeTableName(customTableName) : sanitizeTableName(rawFileName);
  const format = detectFormat(rawFileName);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from ${url} (${response.status}: ${response.statusText})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const virtualName = `remote_${Date.now()}_${rawFileName}`;

  await db.registerFileBuffer(virtualName, uint8Array);

  let createSql = '';
  if (format === 'parquet') {
    createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_parquet('${virtualName}');`;
  } else if (format === 'csv') {
    createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${virtualName}');`;
  } else if (format === 'json') {
    createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${virtualName}');`;
  } else if (format === 'excel') {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const csvContent = XLSX.utils.sheet_to_csv(firstSheet);
    const csvBytes = new TextEncoder().encode(csvContent);
    const excelVirtual = `${virtualName}.csv`;
    await db.registerFileBuffer(excelVirtual, csvBytes);
    createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${excelVirtual}');`;
  } else {
    createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${virtualName}');`;
  }

  await conn.query(createSql);

  return {
    name: rawFileName,
    size: uint8Array.byteLength,
    format,
    tableName,
    loadedAt: Date.now(),
  };
}

/**
 * Loads a remote sample file into DuckDB virtual filesystem.
 */
export async function loadSampleDataset(url: string, fileName: string): Promise<IngestedFileRecord> {
  return ingestRemoteUrl(url, fileName);
}
