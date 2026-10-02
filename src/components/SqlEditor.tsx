import React, { useState, useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor, IDisposable, Position } from 'monaco-editor';
import { format } from 'sql-formatter';
import {
  Play,
  AlignLeft,
  Plus,
  X,
  Code2,
  ChevronDown,
  Sparkles,
  Network,
  Edit2,
  Check
} from 'lucide-react';
import { EditorTab, TableSchema } from '../engine/types';

interface SqlEditorProps {
  tabs: EditorTab[];
  activeTabId: string;
  tables: TableSchema[];
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  onRenameTab?: (tabId: string, newTitle: string) => void;
  query: string;
  onChangeQuery: (value: string) => void;
  onRunQuery: (selectedSql?: string) => void;
  onExplainQuery: (sqlToExplain: string) => void;
  isExecuting: boolean;
}

const SNIPPETS = [
  {
    title: 'Aggregate Summary',
    sql: `SELECT \n  product_category,\n  count(*) AS total_orders,\n  round(sum(total_amount), 2) AS revenue\nFROM ecommerce_orders\nGROUP BY product_category\nORDER BY revenue DESC;`,
  },
  {
    title: 'Window Function (Rank)',
    sql: `SELECT \n  order_id,\n  product_category,\n  total_amount,\n  dense_rank() OVER (PARTITION BY product_category ORDER BY total_amount DESC) AS category_rank\nFROM ecommerce_orders\nQUALIFY category_rank <= 3;`,
  },
  {
    title: 'DuckDB Dynamic Columns',
    sql: `SELECT \n  COLUMNS(* EXCLUDE (order_id, discount))\nFROM ecommerce_orders\nLIMIT 20;`,
  },
  {
    title: 'Query JSON Dataset',
    sql: `SELECT \n  repo,\n  stars,\n  forks,\n  topics\nFROM github_repositories\nWHERE stars > 10000\nORDER BY stars DESC;`,
  },
  {
    title: 'Table Profiler (SUMMARIZE)',
    sql: `SUMMARIZE ecommerce_orders;`,
  },
  {
    title: 'DuckDB System Version & Pragmas',
    sql: `SELECT version() AS duckdb_version, current_setting('threads') AS threads, current_setting('memory_limit') AS memory;`,
  },
];

const DUCKDB_FUNCTIONS = [
  { label: 'SUMMARIZE', detail: 'DuckDB statistical profiler for all columns' },
  { label: 'COLUMNS(*)', detail: 'Dynamic multi-column expression' },
  { label: 'time_bucket', detail: 'time_bucket(INTERVAL, timestamp)' },
  { label: 'arg_max', detail: 'arg_max(arg, val) - returns arg for max val' },
  { label: 'arg_min', detail: 'arg_min(arg, val) - returns arg for min val' },
  { label: 'quantile_cont', detail: 'quantile_cont(col, 0.5) - median or percentile' },
  { label: 'approx_count_distinct', detail: 'HyperLogLog distinct estimate' },
  { label: 'unnest', detail: 'unnest(list_or_array) - unrolls lists into rows' },
  { label: 'string_split', detail: 'string_split(text, regex_or_delim)' },
  { label: 'date_trunc', detail: 'date_trunc(part, date_or_time)' },
  { label: 'QUALIFY', detail: 'Filter window function expressions directly' },
  { label: 'read_parquet', detail: 'read_parquet(url_or_file)' },
  { label: 'read_csv_auto', detail: 'read_csv_auto(url_or_file)' },
  { label: 'read_json_auto', detail: 'read_json_auto(url_or_file)' },
];

export const SqlEditor: React.FC<SqlEditorProps> = ({
  tabs,
  activeTabId,
  tables,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onRenameTab,
  query,
  onChangeQuery,
  onRunQuery,
  onExplainQuery,
  isExecuting,
}) => {
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const completionDisposableRef = useRef<IDisposable | null>(null);
  const tablesRef = useRef(tables);

  // Keep tablesRef current for autocomplete closure
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  // Get active text or selected text
  const getQueryToRun = () => {
    const ed = editorRef.current;
    if (ed) {
      const selection = ed.getSelection();
      if (selection && !selection.isEmpty()) {
        const selectedText = ed.getModel()?.getValueInRange(selection);
        if (selectedText && selectedText.trim()) {
          return selectedText.trim();
        }
      }
    }
    return query.trim();
  };

  const handleFormatSql = () => {
    try {
      const formatted = format(query, {
        language: 'sql',
        keywordCase: 'upper',
        indentStyle: 'standard',
        tabWidth: 2,
      });
      onChangeQuery(formatted);
    } catch {
      // ignore
    }
  };

  const handleRun = () => {
    const toRun = getQueryToRun();
    onRunQuery(toRun);
  };

  const handleExplain = () => {
    const toRun = getQueryToRun();
    onExplainQuery(toRun);
  };

  const startRenameTab = (tab: EditorTab, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditTitle(tab.title);
  };

  const commitRenameTab = () => {
    if (editingTabId && onRenameTab && editTitle.trim()) {
      onRenameTab(editingTabId, editTitle.trim());
    }
    setEditingTabId(null);
  };

  const cancelRenameTab = () => {
    setEditingTabId(null);
  };

  const handleEditorDidMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;

    // Keybinding Ctrl+Enter or Cmd+Enter to Run
    ed.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        handleRun();
      }
    );

    // Keybinding Shift+Alt+F / Ctrl+Shift+F to Format
    ed.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => {
        handleFormatSql();
      }
    );

    // Dispose old provider if exists
    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
    }

    // Register dynamic schema-aware completion provider using live tablesRef
    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: editor.ITextModel, position: Position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const currentTables = tablesRef.current;
        const suggestions: Array<{
          label: string;
          kind: number;
          insertText: string;
          detail: string;
          range: typeof range;
        }> = [];

        // 1. Live Loaded Tables from catalog
        currentTables.forEach((t) => {
          suggestions.push({
            label: t.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: `"${t.name}"`,
            detail: `Table (${t.columns.length} cols, ${t.rowCount?.toLocaleString() ?? 0} rows)`,
            range,
          });

          // 2. Table Columns
          t.columns.forEach((col) => {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: `"${col.name}"`,
              detail: `${col.type} (from ${t.name})`,
              range,
            });
          });
        });

        // 3. DuckDB Functions
        DUCKDB_FUNCTIONS.forEach((fn) => {
          suggestions.push({
            label: fn.label,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: fn.label,
            detail: fn.detail,
            range,
          });
        });

        return { suggestions };
      },
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0D131F]">
      {/* Tab bar & Toolbar */}
      <div className="h-10 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between px-2 select-none">
        {/* Tabs list */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isEditing = editingTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                onDoubleClick={(e) => startRenameTab(tab, e)}
                className={`group flex items-center space-x-1.5 px-3 py-1.5 rounded-t-md text-xs cursor-pointer border-t border-x transition-colors ${
                  isActive
                    ? 'bg-[#0D131F] text-amber-400 border-slate-700 font-medium'
                    : 'bg-slate-900/60 text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title="Click to switch tab, double-click to rename"
              >
                <Code2 className="w-3 h-3 text-slate-400 group-hover:text-amber-400 shrink-0" />

                {isEditing ? (
                  <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRenameTab();
                        if (e.key === 'Escape') cancelRenameTab();
                      }}
                      onBlur={commitRenameTab}
                      className="w-24 px-1 py-0.5 bg-slate-950 border border-amber-500 rounded text-slate-100 text-xs focus:outline-none"
                    />
                    <button
                      onClick={commitRenameTab}
                      className="p-0.5 text-emerald-400 hover:text-emerald-300"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="truncate max-w-[120px]">{tab.title}</span>
                    {onRenameTab && (
                      <button
                        onClick={(e) => startRenameTab(tab, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-500 hover:text-slate-300 transition-opacity"
                        title="Rename Tab"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </>
                )}

                {tabs.length > 1 && !isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 ml-1"
                    title="Close tab"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={onAddTab}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="New SQL Tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toolbar actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Snippets Dropdown */}
          <div className="relative">
            <button
              onClick={() => setSnippetsOpen(!snippetsOpen)}
              className="px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80 flex items-center space-x-1 transition-colors"
              title="DuckDB SQL Recipes & Snippets"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Snippets</span>
              <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
            </button>

            {snippetsOpen && (
              <div
                className="absolute right-0 mt-1 w-64 rounded-md bg-slate-900 border border-slate-700 shadow-xl py-1 z-50 text-xs"
                onMouseLeave={() => setSnippetsOpen(false)}
              >
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  DuckDB Analytical Recipes
                </div>
                {SNIPPETS.map((snippet) => (
                  <button
                    key={snippet.title}
                    onClick={() => {
                      onChangeQuery(snippet.sql);
                      setSnippetsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-200 flex flex-col"
                  >
                    <span className="font-medium text-amber-300">{snippet.title}</span>
                    <span className="text-[10px] text-slate-400 truncate">{snippet.sql.replace(/\s+/g, ' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Format SQL Button */}
          <button
            onClick={handleFormatSql}
            className="px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80 flex items-center space-x-1 transition-colors"
            title="Format SQL Query (Shift + Alt + F)"
          >
            <AlignLeft className="w-3 h-3 text-cyan-400" />
            <span>Format</span>
          </button>

          {/* Explain Plan Button */}
          <button
            onClick={handleExplain}
            disabled={isExecuting}
            className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-800/50 flex items-center space-x-1 transition-colors"
            title="Inspect Query Execution Plan (EXPLAIN)"
          >
            <Network className="w-3 h-3 text-purple-400" />
            <span className="hidden sm:inline">Explain</span>
          </button>

          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={isExecuting}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              isExecuting
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
            }`}
            title="Run Query or Selected Lines (Ctrl+Enter)"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Run</span>
          </button>
        </div>
      </div>

      {/* Monaco SQL Editor */}
      <div className="flex-1 w-full relative">
        <Editor
          height="100%"
          language="sql"
          theme="vs-dark"
          value={query}
          onChange={(val) => onChangeQuery(val || '')}
          onMount={handleEditorDidMount}
          options={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 13,
            lineHeight: 20,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            renderLineHighlight: 'line',
            padding: { top: 8, bottom: 8 },
            suggestOnTriggerCharacters: true,
            folding: true,
          }}
        />
      </div>
    </div>
  );
};
