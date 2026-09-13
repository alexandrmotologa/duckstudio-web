# DuckStudio Web

DuckStudio Web is a client-side analytical SQL workbench that runs DuckDB directly inside the browser using WebAssembly. It allows you to drag and drop Parquet, CSV, JSON, and Arrow files and query them with standard SQL. All computation happens locally in a Web Worker; no data is uploaded to a remote server.

## Features

- Local SQL engine: Runs DuckDB-Wasm in a dedicated Web Worker. Queries run against local memory and browser-managed buffers.
- Format support: Ingests Parquet, CSV, TSV, JSON, JSON Lines, and Arrow IPC files directly via drag and drop.
- Schema explorer: Inspects registered tables, views, column data types, and estimated row counts. Includes quick shortcuts for table preview, counting, and profiling.
- Monaco SQL editor: Features syntax highlighting, multi-tab query sheets, SQL formatting, and keyboard shortcuts (`Ctrl+Enter` or `Cmd+Enter` to execute).
- High performance virtualized table: Renders result sets smoothly using TanStack Virtual, with column sorting, text search filtering, and single-cell copy.
- Interactive charting: Generates Bar, Line, Area, Scatter, and Pie charts from query result columns using Recharts.
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
- `src/engine/fileLoader.ts`: Handles file drops and registers virtual tables in DuckDB.
- `src/engine/queryExecutor.ts`: Executes SQL queries, measures execution time, and converts Apache Arrow tables into JavaScript objects.
- `src/components/`: Modular React components for the editor, catalog sidebar, virtualized table, chart visualizer, and export controls.

For details on the WebAssembly bridge and memory management, see [docs/architecture.md](docs/architecture.md).

## License

MIT License. See [LICENSE](LICENSE) for details.
