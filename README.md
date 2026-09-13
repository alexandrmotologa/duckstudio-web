# DuckStudio Web

DuckStudio Web is a client-side analytical SQL workbench that runs DuckDB directly inside the browser using WebAssembly. It allows you to drag and drop Parquet, CSV, JSON, Arrow, and Excel files and query them with standard SQL. All computation happens locally in a Web Worker; no data is uploaded to a remote server.

## Features

- Local SQL engine: Runs DuckDB-Wasm in a dedicated Web Worker. Queries run against local memory and browser-managed buffers.
- Format support: Ingests Parquet, CSV, TSV, JSON, JSON Lines, Arrow IPC, and Excel (`.xlsx` and `.xls`) spreadsheets via drag and drop.
- Remote URL ingestion: Loads datasets directly from public HTTP or HTTPS URLs (HuggingFace, GitHub, S3) into DuckDB.
- Schema explorer: Inspects registered tables, views, column data types, and estimated row counts. Includes quick shortcuts for table preview, counting, and profiling.
- Schema-aware Monaco SQL editor: Autocompletes active table names, column names with data types, and DuckDB analytical functions. Supports multi-tab query sheets, SQL formatting, selection-based query runs, and keyboard shortcuts (`Ctrl+Enter` or `Cmd+Enter`).
- Resizable split-pane: Drag the divider between the editor and the results table, or use one-click buttons to maximize the editor or grid.
- Column statistics and profiling: Click any column header to view distinct values, null counts, min, max, average, and top 5 frequent values with instant filter insertion.
- Visual query profiler: Inspects `EXPLAIN` and `EXPLAIN ANALYZE` physical execution trees to evaluate query performance.
- High performance virtualized table: Renders result sets smoothly using TanStack Virtual, with column sorting, text search filtering, and single-cell copy.
- Interactive charting: Generates Bar, Line, Area, Scatter, and Pie charts from query result columns using Recharts, with one-click export to PNG and SVG images.
- Client-side export: Downloads query results as CSV, JSON, or compressed Parquet files generated directly by DuckDB. Also supports copying as Markdown tables or TSV.
- Query history: Persists executed queries, execution durations, and row counts locally in browser storage.
- Sample datasets: Bundles sample e-commerce and GitHub repository data for immediate testing without local files.

## Privacy and security

DuckStudio Web operates entirely on your device:

1. When you drop a file into the application, the browser assigns a local file handle using the File API.
2. The file is registered into DuckDB's in-memory virtual filesystem.
3. Queries execute inside the Web Worker through WebAssembly.
4. Zero network requests are made with your file content or query text. You can disconnect your network connection or inspect the browser DevTools Network tab to verify that no traffic leaves the browser during execution.

## Getting started

### Prerequisites

Node.js 18 or later and npm.

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/alexandrmotologa/duckstudio-web.git
cd duckstudio-web
npm install
```

### Development server

Start the local Vite development server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Production build

Build static assets:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

The output in `dist/` is static HTML, JavaScript, CSS, and WebAssembly assets. It can be hosted on GitHub Pages, Vercel, Netlify, Cloudflare Pages, or any static file server.

## Architecture

The project separates UI rendering from data processing:

- `src/engine/duckdbWorker.ts`: Manages the DuckDB-Wasm instance, bundle selection (MVP vs EH), and Web Worker lifecycle.
- `src/engine/fileLoader.ts`: Handles file drops (Parquet, CSV, JSON, Arrow, Excel) and registers virtual tables in DuckDB.
- `src/engine/queryExecutor.ts`: Executes SQL queries, measures execution time, produces execution plans (`EXPLAIN`), and converts Apache Arrow tables into JavaScript objects.
- `src/components/`: Modular React components for the editor, catalog sidebar, virtualized table, chart visualizer, column profiler, and export controls.

For details on the WebAssembly bridge and memory management, see [docs/architecture.md](docs/architecture.md).

## License

MIT License. See [LICENSE](LICENSE) for details.
