import { describe, it, expect } from 'vitest';
import {
  normalizeValue,
  convertRowsToCsv,
  convertRowsToMarkdown,
  convertRowsToTsv,
  injectSqlFilter,
} from '../src/engine/queryExecutor';
import { sanitizeTableName, detectFormat } from '../src/engine/fileLoader';

describe('Engine Data Normalization', () => {
  it('converts BigInt within safe integer range to number', () => {
    const input = BigInt(42);
    expect(normalizeValue(input)).toBe(42);
    expect(typeof normalizeValue(input)).toBe('number');
  });

  it('converts BigInt outside safe integer range to string', () => {
    const huge = BigInt('9007199254740999999');
    expect(normalizeValue(huge)).toBe('9007199254740999999');
    expect(typeof normalizeValue(huge)).toBe('string');
  });

  it('converts Date instances to ISO strings', () => {
    const d = new Date('2025-01-15T12:00:00Z');
    expect(normalizeValue(d)).toBe('2025-01-15T12:00:00.000Z');
  });

  it('handles null and undefined safely', () => {
    expect(normalizeValue(null)).toBeNull();
    expect(normalizeValue(undefined)).toBeNull();
  });

  it('recursively normalizes nested structures', () => {
    const nested = {
      id: BigInt(101),
      tags: ['analytics', 'duckdb'],
      meta: { count: BigInt(5) },
    };
    const result = normalizeValue(nested) as typeof nested;
    expect(result.id).toBe(101);
    expect(result.tags).toEqual(['analytics', 'duckdb']);
    expect(result.meta.count).toBe(5);
  });
});

describe('File Name and Format Detection', () => {
  it('sanitizes various file names to valid SQL identifiers', () => {
    expect(sanitizeTableName('sales_data_2025.csv')).toBe('sales_data_2025');
    expect(sanitizeTableName('My-Report (Final).parquet')).toBe('my_report_final');
    expect(sanitizeTableName('99_bottles.json')).toBe('t_99_bottles');
    expect(sanitizeTableName('___')).toBe('data_table');
  });

  it('detects file formats correctly', () => {
    expect(detectFormat('data.parquet')).toBe('parquet');
    expect(detectFormat('data.pq')).toBe('parquet');
    expect(detectFormat('orders.csv')).toBe('csv');
    expect(detectFormat('metrics.tsv')).toBe('csv');
    expect(detectFormat('payload.json')).toBe('json');
    expect(detectFormat('stream.ndjson')).toBe('json');
    expect(detectFormat('table.arrow')).toBe('arrow');
    expect(detectFormat('spreadsheet.xlsx')).toBe('excel');
    expect(detectFormat('legacy.xls')).toBe('excel');
    expect(detectFormat('unknown.bin')).toBe('unknown');
  });
});

describe('Export Formatting', () => {
  const columns = ['category', 'revenue', 'active'];
  const rows = [
    { category: 'Electronics', revenue: 1500.5, active: true },
    { category: 'Books', revenue: 320.0, active: false },
  ];

  it('formats rows into valid CSV', () => {
    const csv = convertRowsToCsv(columns, rows);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"category","revenue","active"');
    expect(lines[1]).toBe('"Electronics","1500.5","true"');
    expect(lines[2]).toBe('"Books","320","false"');
  });

  it('formats rows into Markdown table', () => {
    const md = convertRowsToMarkdown(columns, rows);
    expect(md).toContain('| category | revenue | active |');
    expect(md).toContain('| --- | --- | --- |');
    expect(md).toContain('| Electronics | 1500.5 | true |');
  });

  it('formats rows into TSV', () => {
    const tsv = convertRowsToTsv(columns, rows);
    const lines = tsv.split('\n');
    expect(lines[0]).toBe('category\trevenue\tactive');
    expect(lines[1]).toBe('Electronics\t1500.5\ttrue');
    expect(lines[2]).toBe('Books\t320\tfalse');
  });
});

describe('SQL Filter Injection (injectSqlFilter)', () => {
  it('injects WHERE clause into simple SELECT query', () => {
    const sql = 'SELECT * FROM orders;';
    const res = injectSqlFilter(sql, 'status', 'completed', '=');
    expect(res).toBe('SELECT * FROM orders\nWHERE "status" = \'completed\';');
  });

  it('injects condition into existing WHERE clause', () => {
    const sql = 'SELECT * FROM orders WHERE total > 100;';
    const res = injectSqlFilter(sql, 'country', 'RO', '=');
    expect(res).toBe('SELECT * FROM orders WHERE total > 100 AND "country" = \'RO\';');
  });

  it('injects condition before GROUP BY clause', () => {
    const sql = 'SELECT category, count(*) FROM orders GROUP BY category ORDER BY count DESC;';
    const res = injectSqlFilter(sql, 'category', 'Electronics', '=');
    expect(res).toContain('WHERE "category" = \'Electronics\'');
    expect(res).toContain('GROUP BY category');
    expect(res.indexOf('WHERE')).toBeLessThan(res.indexOf('GROUP BY'));
  });

  it('injects condition before ORDER BY clause when WHERE exists', () => {
    const sql = 'SELECT * FROM orders WHERE active = true ORDER BY created_at DESC LIMIT 10;';
    const res = injectSqlFilter(sql, 'priority', 'high', '=');
    expect(res).toContain('WHERE active = true AND "priority" = \'high\'');
    expect(res).toContain('ORDER BY created_at DESC LIMIT 10;');
  });

  it('escapes single quotes in filter values', () => {
    const sql = 'SELECT * FROM users;';
    const res = injectSqlFilter(sql, 'name', "O'Connor", '=');
    expect(res).toContain("WHERE \"name\" = 'O''Connor';");
  });

  it('supports != operator', () => {
    const sql = 'SELECT * FROM users;';
    const res = injectSqlFilter(sql, 'role', 'admin', '!=');
    expect(res).toContain("WHERE \"role\" != 'admin';");
  });
});
