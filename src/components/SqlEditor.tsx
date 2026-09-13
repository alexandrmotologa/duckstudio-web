import React, { useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { format } from 'sql-formatter';
import {
  Play,
  AlignLeft,
  Plus,
  X,
  Code2,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { EditorTab } from '../engine/types';

interface SqlEditorProps {
  tabs: EditorTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  query: string;
  onChangeQuery: (value: string) => void;
  onRunQuery: () => void;
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
];

export const SqlEditor: React.FC<SqlEditorProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  query,
  onChangeQuery,
  onRunQuery,
  isExecuting,
}) => {
  const [snippetsOpen, setSnippetsOpen] = useState(false);

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
      // ignore formatting errors for non-standard SQL
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // Add command for Cmd+Enter / Ctrl+Enter
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        onRunQuery();
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0D131F]">
      {/* Tab bar & Toolbar */}
      <div className="h-10 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between px-2 select-none">
        {/* Tabs list */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`group flex items-center space-x-2 px-3 py-1.5 rounded-t-md text-xs cursor-pointer border-t border-x transition-colors ${
                  isActive
                    ? 'bg-[#0D131F] text-amber-400 border-slate-700 font-medium'
                    : 'bg-slate-900/60 text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Code2 className="w-3 h-3 text-slate-400 group-hover:text-amber-400" />
                <span className="truncate max-w-[120px]">{tab.title}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700"
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
            title="Format SQL Query"
          >
            <AlignLeft className="w-3 h-3 text-cyan-400" />
            <span>Format</span>
          </button>

          {/* Run Button in Editor Header */}
          <button
            onClick={onRunQuery}
            disabled={isExecuting}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              isExecuting
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
            }`}
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
