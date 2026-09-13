<p align="center">
  <img src="docs/images/logo.png?raw=true" alt="DuckStudio Logo" width="140" style="border-radius: 28px;" />
</p>

<h1 align="center">DuckStudio Web</h1>

<p align="center">
  A privacy-first, client-side analytical SQL workbench powered by DuckDB-Wasm and Apache Arrow.
</p>

<p align="center">
  <a href="https://github.com/alexandrmotologa/duckstudio-web/actions/workflows/ci.yml">
    <img src="https://github.com/alexandrmotologa/duckstudio-web/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
  </a>
  <img src="https://img.shields.io/badge/DuckDB--Wasm-v1.28.0-F59E0B.svg" alt="DuckDB-Wasm" />
  <img src="https://img.shields.io/badge/Architecture-100%25%20Client--Side-10B981.svg" alt="100% Client-Side" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" />
</p>

<p align="center">
  <img src="docs/images/demo.gif?raw=true" alt="DuckStudio Web Interactive Demo" width="880" style="border-radius: 10px; border: 1px solid #1e293b;" />
</p>

---

## Overview

DuckStudio Web runs DuckDB directly inside the browser using WebAssembly. It allows you to drag and drop Parquet, CSV, JSON, Arrow, and Excel files and query them with standard SQL. All computation happens locally in a Web Worker. Zero bytes are transmitted to any server.

## Features

- Local SQL engine: Runs DuckDB-Wasm in a dedicated Web Worker. Queries run against local memory and browser-managed buffers.
- Multi-format ingestion: Ingests Parquet, CSV, TSV, JSON, JSON Lines, Arrow IPC, and Excel (`.xlsx` and `.xls`) spreadsheets via drag and drop.
- Remote URL loader: Loads public datasets directly from HTTP or HTTPS URLs (HuggingFace, GitHub, S3) into DuckDB.
- Schema explorer: Inspects registered tables, views, column types, and row counts with quick actions (`SELECT *`, `COUNT(*)`, `SUMMARIZE`).
- Schema-aware Monaco SQL editor: Autocompletes active table names, column names with data types, and DuckDB analytical functions (`SUMMARIZE`, `COLUMNS(*)`, `time_bucket`, `arg_max`, `unnest`, `QUALIFY`).
- Partial execution: Highlights any block of SQL in the editor to run only the selected lines.
- Resizable split-pane: Draggable divider between the editor and the results table, with one-click buttons to maximize the editor or grid.
- Column statistics and profiling: Click any column header to view distinct counts, null counts, min, max, average, and top 5 frequent values with instant filter injection.
- Visual query profiler: Inspects `EXPLAIN` and `EXPLAIN ANALYZE` physical execution trees to evaluate query performance.
- Virtualized data grid: Renders 50,000+ rows smoothly using TanStack Virtual, with column sorting, text search filtering, and single-cell copy.
- Interactive charting: Generates Bar, Line, Area, Scatter, and Pie charts from query result columns using Recharts, with one-click export to PNG and SVG images.
- Client-side export: Downloads query results as CSV, JSON, or compressed Parquet files generated directly by DuckDB. Also supports copying as Markdown tables or TSV.
- Query history: Persists executed queries, execution durations, and row counts locally in browser storage.
- Bundled sample datasets: Includes sample e-commerce and GitHub repository data for immediate testing.

---

## Visual interface tour

### Main SQL editor & virtualized grid
Query multi-column datasets with instant execution metrics and millisecond runtimes:

<p align="center">
  <img src="docs/images/screenshot_main.png?raw=true" alt="Main SQL Editor and DataGrid" width="880" style="border-radius: 8px; border: 1px solid #1e293b;" />
</p>

### Interactive visualizer (Charts & PNG/SVG export)
Plot distributions, aggregations, and trends directly from SQL query columns:

<p align="center">
  <img src="docs/images/screenshot_chart.png?raw=true" alt="Interactive Chart Visualizer" width="880" style="border-radius: 8px; border: 1px solid #1e293b;" />
</p>

### Column statistics & instant profiling popover
Inspect distinct counts, null values, and frequency bars with one-click filter insertion:

<p align="center">
  <img src="docs/images/screenshot_column_stats.png?raw=true" alt="Column Statistics Popover" width="880" style="border-radius: 8px; border: 1px solid #1e293b;" />
</p>

### Query execution plan (EXPLAIN ANALYZE)
Inspect physical execution trees, scan operators, joins, and filters:

<p align="center">
  <img src="docs/images/screenshot_explain.png?raw=true" alt="Query Execution Plan EXPLAIN" width="880" style="border-radius: 8px; border: 1px solid #1e293b;" />
</p>

### Remote URL dataset ingestion
Load remote Parquet, CSV, or Excel files from public URLs without manual downloading:

<p align="center">
  <img src="docs/images/screenshot_remote_url.png?raw=true" alt="Remote URL Ingestion" width="880" style="border-radius: 8px; border: 1px solid #1e293b;" />
</p>

---

## Privacy and security

DuckStudio Web operates entirely on your device:

1. When you drop a file into the application, the browser assigns a local file handle using the File API.
2. The file is registered into DuckDB's in-memory virtual filesystem.
3. Queries execute inside the Web Worker through WebAssembly.
4. Zero network requests are made with your file content or query text. You can disconnect your network connection or inspect the browser DevTools Network tab to verify that no traffic leaves the browser during execution.

---

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

---

## Architecture

The project separates UI rendering from data processing:

- `src/engine/duckdbWorker.ts`: Manages the DuckDB-Wasm instance, bundle selection (MVP vs EH), and Web Worker lifecycle.
- `src/engine/fileLoader.ts`: Handles file drops (Parquet, CSV, JSON, Arrow, Excel) and registers virtual tables in DuckDB.
- `src/engine/queryExecutor.ts`: Executes SQL queries, measures execution time, produces execution plans (`EXPLAIN`), and converts Apache Arrow tables into JavaScript objects.
- `src/components/`: Modular React components for the editor, catalog sidebar, virtualized table, chart visualizer, column profiler, and export controls.

For details on the WebAssembly bridge and memory management, see [docs/architecture.md](docs/architecture.md).

---

## License

MIT License. See [LICENSE](LICENSE) for details.
