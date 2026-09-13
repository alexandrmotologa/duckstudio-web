import { getDuckDb, getDuckDbConnection } from './duckdbWorker';
import { QueryResult, TableSchema, ExplainResult, ColumnStats, ColumnTopValue } from './types';
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
    if (val && typeof (val as { toJSON?: () => unknown }).toJSON === 'function') {
      try {
        return (val as { toJSON: () => unknown }).toJSON();
      } catch {
        // Fallback
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
 * Runs an EXPLAIN or EXPLAIN ANALYZE on a query to inspect the execution plan tree.
 */
export async function explainQuery(query: string): Promise<ExplainResult> {
  const conn = await getDuckDbConnection();
  const startTime = performance.now();
  const cleanSql = query.replace(/;+\s*$/, '');

  let planText = '';

  try {
    const table = await conn.query(`EXPLAIN ANALYZE ${cleanSql};`);
    const numRows = table.numRows;
    const lines: string[] = [];
    for (let i = 0; i < numRows; i++) {
      const val = table.getChildAt(1)?.get(i) ?? table.getChildAt(0)?.get(i);
      lines.push(String(val));
    }
    planText = lines.join('\n');
  } catch {
    // Fallback to regular EXPLAIN
    const table = await conn.query(`EXPLAIN ${cleanSql};`);
    const numRows = table.numRows;
    const lines: string[] = [];
    for (let i = 0; i < numRows; i++) {
      const val = table.getChildAt(1)?.get(i) ?? table.getChildAt(0)?.get(i);
      lines.push(String(val));
    }
    planText = lines.join('\n');
  }

  const endTime = performance.now();
  return {
    query,
    planText,
    executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
  };
}

/**
 * Computes statistical profiling details for a specific column in a table.
 */
export async function fetchColumnStats(tableName: string, columnName: string, colType = ''): Promise<ColumnStats> {
  const conn = await getDuckDbConnection();
  const safeTable = `"${tableName.replace(/"/g, '""')}"`;
  const safeCol = `"${columnName.replace(/"/g, '""')}"`;

  const isNumeric = /int|double|float|decimal|numeric|real/i.test(colType);

  let summarySql = `
    SELECT 
      count(*)::BIGINT AS total_cnt,
      count(${safeCol})::BIGINT AS non_null_cnt,
      count(DISTINCT ${safeCol})::BIGINT AS distinct_cnt
  `;

  if (isNumeric) {
    summarySql += `,
      round(min(${safeCol})::DOUBLE, 2) AS min_val,
      round(max(${safeCol})::DOUBLE, 2) AS max_val,
      round(avg(${safeCol})::DOUBLE, 2) AS avg_val
    `;
  }

  summarySql += ` FROM ${safeTable};`;

  const summaryRes = await conn.query(summarySql);
  const totalCount = Number(summaryRes.getChildAt(0)?.get(0) ?? 0);
  const nonNullCount = Number(summaryRes.getChildAt(1)?.get(0) ?? 0);
  const distinctCount = Number(summaryRes.getChildAt(2)?.get(0) ?? 0);
  const nullCount = Math.max(0, totalCount - nonNullCount);

  let min: unknown;
  let max: unknown;
  let avg: unknown;

  if (isNumeric) {
    min = summaryRes.getChildAt(3)?.get(0);
    max = summaryRes.getChildAt(4)?.get(0);
    avg = summaryRes.getChildAt(5)?.get(0);
  }

  // Top 5 most frequent values
  const topRes = await conn.query(`
    SELECT 
      ${safeCol}::VARCHAR AS val,
      count(*)::BIGINT AS cnt
    FROM ${safeTable}
    WHERE ${safeCol} IS NOT NULL
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5;
  `);

  const topValues: ColumnTopValue[] = [];
  for (let i = 0; i < topRes.numRows; i++) {
    const valStr = String(topRes.getChildAt(0)?.get(i) ?? 'null');
    const cnt = Number(topRes.getChildAt(1)?.get(i) ?? 0);
    const percentage = totalCount > 0 ? Math.round((cnt / totalCount) * 1000) / 10 : 0;
    topValues.push({ value: valStr, count: cnt, percentage });
  }

  return {
    columnName,
    type: colType,
    totalCount,
    nullCount,
    distinctCount,
    min,
    max,
    avg,
    topValues,
  };
}

/**
 * Inspects the current catalog and lists all registered tables, views, and schemas.
 */
export async function fetchCatalogTables(): Promise<TableSchema[]> {
  try {
    const conn = await getDuckDbConnection();
    
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

      let rowCount = 0;
      try {
        const countRes = await conn.query(`SELECT count(*)::BIGINT AS cnt FROM "${tableName.replace(/"/g, '""')}"`);
        rowCount = Number(countRes.getChildAt(0)?.get(0) ?? 0);
      } catch {
        // dynamic view
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
