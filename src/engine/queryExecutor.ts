import { getDuckDb, getDuckDbConnection } from './duckdbWorker';
import { QueryResult, TableSchema } from './types';
import * as arrow from 'apache-arrow';

/**
 * Recursively converts Arrow vector cell values into clean JavaScript primitives.
 * Safely handles BigInt, Timestamps, Dates, Lists, and Structs.
 */
export function normalizeValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val === 'bigint') {
    if (val <= BigInt(Number.MAX_SAFE_INTEGER) && val >= BigInt(Number.MIN_SAFE_INTEGER)) {
      return Number(val);
    }
    return val.toString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map(normalizeValue);
    }
    // Handle Arrow Vector/Struct
    if (val && typeof (val as { toJSON?: () => unknown }).toJSON === 'function') {
      try {
        return (val as { toJSON: () => unknown }).toJSON();
      } catch {
        // Fallback string conversion
      }
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      result[k] = normalizeValue(v);
    }
    return result;
  }
  return val;
}

/**
 * Executes a SQL query against the active DuckDB-Wasm connection.
 */
export async function executeQuery(query: string): Promise<QueryResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Query cannot be empty');
  }

  const conn = await getDuckDbConnection();
  const startTime = performance.now();

  try {
    const arrowTable: arrow.Table = await conn.query(trimmed);
    const endTime = performance.now();
    const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

    const columns: string[] = arrowTable.schema.fields.map((f) => f.name);
    const columnTypes: Record<string, string> = {};
    arrowTable.schema.fields.forEach((f) => {
      columnTypes[f.name] = f.type.toString();
    });

    const rows: Record<string, unknown>[] = [];
    const numRows = arrowTable.numRows;

    // Zero-overhead extraction from Arrow columns
    for (let r = 0; r < numRows; r++) {
      const rowObj: Record<string, unknown> = {};
      for (let c = 0; c < columns.length; c++) {
        const colName = columns[c];
        const val = arrowTable.getChildAt(c)?.get(r);
        rowObj[colName] = normalizeValue(val);
      }
      rows.push(rowObj);
    }

    return {
      query: trimmed,
      columns,
      columnTypes,
      rows,
      rowCount: numRows,
      executionTimeMs,
      timestamp: Date.now(),
    };
  } catch (err: unknown) {
    const endTime = performance.now();
    const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;
    const errorMessage = err instanceof Error ? err.message : String(err);

    return {
      query: trimmed,
      columns: [],
      columnTypes: {},
      rows: [],
      rowCount: 0,
      executionTimeMs,
      timestamp: Date.now(),
      error: errorMessage,
    };
  }
}

/**
 * Inspects the current catalog and lists all registered tables, views, and schemas.
 */
export async function fetchCatalogTables(): Promise<TableSchema[]> {
  try {
    const conn = await getDuckDbConnection();
    
    // Query system catalog for base tables and views
    const tablesResult = await conn.query(`
      SELECT 
        table_name, 
        table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'main'
      ORDER BY table_name;
    `);

    const tables: TableSchema[] = [];
    const numTables = tablesResult.numRows;

    for (let i = 0; i < numTables; i++) {
      const tableName = String(tablesResult.getChildAt(0)?.get(i));
      const tableType = String(tablesResult.getChildAt(1)?.get(i)) as 'BASE TABLE' | 'VIEW';

      // Inspect column definitions
      const columnsResult = await conn.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = '${tableName.replace(/'/g, "''")}'
        ORDER BY ordinal_position;
      `);

      const columns = [];
      for (let c = 0; c < columnsResult.numRows; c++) {
        columns.push({
          name: String(columnsResult.getChildAt(0)?.get(c)),
          type: String(columnsResult.getChildAt(1)?.get(c)),
          nullable: String(columnsResult.getChildAt(2)?.get(c)) === 'YES',
        });
      }

      // Count rows safely
      let rowCount = 0;
      try {
        const countRes = await conn.query(`SELECT count(*)::BIGINT AS cnt FROM "${tableName.replace(/"/g, '""')}"`);
        rowCount = Number(countRes.getChildAt(0)?.get(0) ?? 0);
      } catch {
        // May be a dynamic view
      }

      tables.push({
        name: tableName,
        type: tableType,
        columns,
        rowCount,
      });
    }

    return tables;
  } catch (err) {
    console.error('Failed to fetch catalog tables:', err);
    return [];
  }
}

/**
 * Exports query results directly into a Parquet binary buffer via DuckDB.
 */
export async function exportQueryToParquet(query: string): Promise<Uint8Array> {
  const db = await getDuckDb();
  const conn = await getDuckDbConnection();
  const tempFile = `export_${Date.now()}.parquet`;

  // Use DuckDB native COPY statement
  const copySql = `COPY (${query.replace(/;+\s*$/, '')}) TO '${tempFile}' (FORMAT PARQUET, COMPRESSION 'ZSTD');`;
  await conn.query(copySql);

  const buffer = await db.copyFileToBuffer(tempFile);
  await db.dropFile(tempFile);
  return buffer;
}

/**
 * Converts query rows into a CSV string.
 */
export function convertRowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  if (!columns.length) return '';
  const header = columns.map((col) => `"${col.replace(/"/g, '""')}"`).join(',');
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

/**
 * Formats query rows into a Markdown table string.
 */
export function convertRowsToMarkdown(columns: string[], rows: Record<string, unknown>[], maxRows = 100): string {
  if (!columns.length) return '';
  const header = `| ${columns.join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;
  const slice = rows.slice(0, maxRows);
  const lines = slice.map(
    (row) => `| ${columns.map((c) => String(row[c] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`
  );
  let md = [header, separator, ...lines].join('\n');
  if (rows.length > maxRows) {
    md += `\n\n*... and ${rows.length - maxRows} more rows*`;
  }
  return md;
}
