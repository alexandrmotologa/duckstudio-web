# DuckStudio Web architecture

DuckStudio Web runs client-side analytical queries on structured files without sending data to an external server. This document explains how the components interact and how data flows from user input to screen rendering.

## System overview

```
User File (.parquet, .csv, .json)
              │
              ▼
    File API / Drag & Drop
              │
              ▼
      fileLoader.ts (Virtual File Registration)
              │
              ▼
   Web Worker (DuckDB-Wasm Instance)
              │
              ▼
   Query Execution & Arrow Vector Table
              │
              ▼
      queryExecutor.ts (Data Normalization)
              │
       ┌──────┴──────────────┐
       ▼                     ▼
DataGrid.tsx (TanStack)  VisualizerModal.tsx (Recharts)
```

## Engine and worker layer

The application uses `@duckdb/duckdb-wasm`. DuckDB is compiled from C++ to WebAssembly with two primary targets:

1. Exception Handling (EH) bundle: Uses WebAssembly exception handling proposals for better performance on modern browsers.
2. MVP bundle: Fallback target for browsers lacking recent WebAssembly extension flags.

The worker initialization logic lives in `src/engine/duckdbWorker.ts`. It selects the appropriate bundle at startup, instantiates the Web Worker, and attaches a logging listener. Because WebAssembly compilation and query planning can be CPU-intensive, running inside a Dedicated Web Worker prevents the browser main thread from freezing during complex aggregations.

## File registration and virtual filesystem

When a user drops a file or loads a sample, `src/engine/fileLoader.ts` registers the file in DuckDB's in-memory virtual file system:

- For local files, it uses `db.registerFileHandle()` with `DuckDBDataProtocol.BROWSER_FILEREADER`. DuckDB reads chunks directly from the local browser file handle without loading the entire file into JavaScript heap memory up front.
- For remote samples, it fetches the ArrayBuffer and uses `db.registerFileBuffer()`.

Once registered, a view or table is created using DuckDB's native readers:

```sql
-- Parquet
CREATE OR REPLACE VIEW "orders" AS SELECT * FROM read_parquet('file_orders.parquet');

-- CSV with automatic schema and delimiter detection
CREATE OR REPLACE VIEW "sales" AS SELECT * FROM read_csv_auto('file_sales.csv');

-- JSON with schema inference
CREATE OR REPLACE VIEW "repos" AS SELECT * FROM read_json_auto('file_repos.json');
```

## Arrow conversion and query execution

Query execution in `src/engine/queryExecutor.ts` issues the SQL text through the active connection. DuckDB returns an Apache Arrow `Table`.

Arrow stores data in columnar chunks rather than row objects. To render rows in the UI, `normalizeValue()` iterates through columns and converts Arrow vector values into JavaScript types:

- BigInt values within `Number.MIN_SAFE_INTEGER` and `Number.MAX_SAFE_INTEGER` are converted to standard numbers. Larger integers are kept as strings to prevent precision loss.
- Timestamps and dates are converted to ISO strings.
- Lists and Structs are converted to nested arrays and objects.

## Rendering and virtualized grid

Large queries can return tens of thousands of rows. Creating DOM nodes for every row causes noticeable frame drops and high memory consumption.

`src/components/DataGrid.tsx` uses `@tanstack/react-virtual`. It only renders rows currently visible within the scrolling viewport plus a small buffer (overscan). This keeps rendering performance at 60 frames per second regardless of table size.

## Native Parquet exports

DuckStudio Web exports query results to Parquet without requiring external third-party encoding libraries. It uses DuckDB's built-in `COPY` command:

```sql
COPY (SELECT ...) TO 'export.parquet' (FORMAT PARQUET, COMPRESSION 'ZSTD');
```

DuckDB writes the Parquet file into its virtual filesystem. The application then reads the binary buffer using `db.copyFileToBuffer()`, wraps it in a browser Blob, and triggers a local download.
