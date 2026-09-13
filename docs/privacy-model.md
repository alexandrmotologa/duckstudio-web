# Privacy model

DuckStudio Web runs without backend servers, analytical tracking, or cloud query processors. This document details how data privacy is maintained during file inspection and query execution.

## Local execution model

When using traditional web-based data viewers, uploaded files are sent across the network to a remote server, parsed in a backend container, and sent back as JSON responses. This introduces exposure risks for proprietary company datasets, customer records, and confidential telemetry.

DuckStudio Web uses a local-first design:

1. Assets (HTML, CSS, JavaScript, and WebAssembly binaries) are served statically to your browser.
2. Once loaded, the browser executes the application code entirely in local memory.
3. User files dragged into the application stay on the local filesystem. The browser File API grants read access strictly to the client-side Web Worker.
4. All SQL parsing, query planning, filter evaluation, aggregations, and data exports execute within the browser's WebAssembly sandbox.

## Verifying network behavior

You can verify that no data leaves your machine:

1. Open your browser developer tools (F12 or Ctrl+Shift+I).
2. Navigate to the Network tab.
3. Filter by `Fetch/XHR` or `All`.
4. Drag and drop a private Parquet or CSV file into DuckStudio Web.
5. Run several SQL queries and export the results.

You will observe zero outgoing network requests during these operations.

## Storage and persistence

DuckStudio Web stores minimal session state in browser `localStorage`:

- SQL editor tabs and current query drafts.
- Recent query history (query strings, timestamps, and execution durations).

No file contents, raw dataset buffers, or query result rows are saved to persistent browser storage. When you close or refresh the tab, all memory allocated by DuckDB-Wasm and the Web Worker is discarded by the browser engine.
