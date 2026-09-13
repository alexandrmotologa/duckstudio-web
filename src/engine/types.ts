export interface ColumnMeta {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface TableSchema {
  name: string;
  type: 'BASE TABLE' | 'VIEW';
  rowCount?: number;
  columns: ColumnMeta[];
  sizeFormatted?: string;
  fileName?: string;
}

export interface QueryResult {
  query: string;
  columns: string[];
  columnTypes: Record<string, string>;
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  timestamp: number;
  error?: string;
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  executionTimeMs: number;
  rowCount: number;
  status: 'success' | 'error';
  error?: string;
}

export interface EditorTab {
  id: string;
  title: string;
  query: string;
}

export type ChartType = 'bar' | 'line' | 'area' | 'scatter' | 'pie';

export interface ChartConfig {
  type: ChartType;
  xAxis: string;
  yAxis: string;
  secondaryYAxis?: string;
  title?: string;
}

export interface IngestedFileRecord {
  name: string;
  size: number;
  format: 'parquet' | 'csv' | 'json' | 'arrow' | 'unknown';
  tableName: string;
  loadedAt: number;
}
