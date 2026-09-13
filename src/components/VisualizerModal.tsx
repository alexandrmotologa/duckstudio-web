import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  BarChart2,
  TrendingUp,
  PieChart as PieIcon,
  Activity,
  Maximize2,
  Image as ImageIcon,
  FileCode
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { QueryResult, ChartType } from '../engine/types';

interface VisualizerModalProps {
  result: QueryResult;
  onClose: () => void;
}

const PALETTE = ['#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#F43F5E', '#3B82F6', '#EC4899', '#14B8A6'];

export const VisualizerModal: React.FC<VisualizerModalProps> = ({ result, onClose }) => {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { numericCols, allCols } = useMemo(() => {
    const all = result.columns;
    const numCols = all.filter((col) => {
      let count = 0;
      let valid = 0;
      for (const r of result.rows.slice(0, 50)) {
        const v = r[col];
        if (v !== null && v !== undefined && v !== '') {
          count++;
          if (typeof v === 'number' || !isNaN(Number(v))) valid++;
        }
      }
      return count > 0 && valid / count > 0.7;
    });
    return { numericCols: numCols, allCols: all };
  }, [result]);

  const defaultX = allCols.find((c) => !numericCols.includes(c)) || allCols[0] || '';
  const defaultY = numericCols[0] || allCols[1] || allCols[0] || '';

  const [xAxisCol, setXAxisCol] = useState<string>(defaultX);
  const [yAxisCol, setYAxisCol] = useState<string>(defaultY);

  const chartData = useMemo(() => {
    return result.rows.slice(0, 100).map((row) => {
      const xVal = row[xAxisCol];
      const yVal = row[yAxisCol];
      return {
        [xAxisCol]: xVal === null || xVal === undefined ? 'null' : String(xVal),
        [yAxisCol]: Number(yVal) || 0,
      };
    });
  }, [result, xAxisCol, yAxisCol]);

  const stats = useMemo(() => {
    const values = chartData.map((d) => Number(d[yAxisCol]) || 0);
    if (!values.length) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    return {
      sum: Math.round(sum * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      max: Math.round(max * 100) / 100,
      min: Math.round(min * 100) / 100,
    };
  }, [chartData, yAxisCol]);

  // Download SVG
  const handleDownloadSvg = () => {
    const container = chartContainerRef.current;
    if (!container) return;
    const svgElem = container.querySelector('svg');
    if (!svgElem) return;

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElem);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `duckstudio_chart_${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download PNG
  const handleDownloadPng = () => {
    const container = chartContainerRef.current;
    if (!container) return;
    const svgElem = container.querySelector('svg');
    if (!svgElem) return;

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElem);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const rect = svgElem.getBoundingClientRect();
    const width = Math.max(rect.width, 800);
    const height = Math.max(rect.height, 450);

    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2, 2);
    ctx.fillStyle = '#0B0F17';
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `duckstudio_chart_${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(pngUrl);
        URL.revokeObjectURL(url);
      });
    };
    img.src = url;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="h-14 border-b border-slate-800 px-5 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Interactive Visualizer</h3>
              <p className="text-[11px] text-slate-400">
                Visualizing query results ({chartData.length} records plotted)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadPng}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors"
              title="Download as PNG"
            >
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>PNG</span>
            </button>

            <button
              onClick={handleDownloadSvg}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors"
              title="Download as vector SVG"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span>SVG</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chart Configuration Toolbar */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Chart Type Selector */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setChartType('bar')}
              className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-colors ${
                chartType === 'bar' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Bar</span>
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-colors ${
                chartType === 'line' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Line</span>
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-colors ${
                chartType === 'area' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Area</span>
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-colors ${
                chartType === 'pie' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Pie</span>
            </button>
            <button
              onClick={() => setChartType('scatter')}
              className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-colors ${
                chartType === 'scatter' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Scatter</span>
            </button>
          </div>

          {/* Axis Selectors */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 font-medium">X-Axis:</span>
              <select
                value={xAxisCol}
                onChange={(e) => setXAxisCol(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500"
              >
                {allCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-400 font-medium">Y-Axis:</span>
              <select
                value={yAxisCol}
                onChange={(e) => setYAxisCol(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500"
              >
                {allCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Chart Canvas Area */}
        <div ref={chartContainerRef} className="flex-1 p-5 bg-[#0B0F17] flex flex-col min-h-0">
          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis dataKey={xAxisCol} stroke="#9CA3AF" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#F3F4F6' }} />
                  <Bar dataKey={yAxisCol} fill="#F59E0B" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis dataKey={xAxisCol} stroke="#9CA3AF" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#F3F4F6' }} />
                  <Line type="monotone" dataKey={yAxisCol} stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981' }} />
                </LineChart>
              ) : chartType === 'area' ? (
                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis dataKey={xAxisCol} stroke="#9CA3AF" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#F3F4F6' }} />
                  <Area type="monotone" dataKey={yAxisCol} stroke="#06B6D4" strokeWidth={2} fillOpacity={1} fill="url(#areaGradient)" />
                </AreaChart>
              ) : chartType === 'pie' ? (
                <PieChart>
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#F3F4F6' }} />
                  <Legend />
                  <Pie data={chartData} dataKey={yAxisCol} nameKey={xAxisCol} cx="50%" cy="50%" outerRadius={120} innerRadius={45} label>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Pie>
                </PieChart>
              ) : (
                <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis dataKey={xAxisCol} stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                  <YAxis dataKey={yAxisCol} stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#F3F4F6' }} />
                  <Scatter name="Points" data={chartData} fill="#8B5CF6" />
                </ScatterChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Metric KPI cards */}
          {stats && (
            <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-4 gap-3 text-xs select-none">
              <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Total Sum</span>
                <div className="font-mono text-base font-bold text-amber-400 mt-0.5">{stats.sum.toLocaleString()}</div>
              </div>
              <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Average</span>
                <div className="font-mono text-base font-bold text-emerald-400 mt-0.5">{stats.avg.toLocaleString()}</div>
              </div>
              <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Max Peak</span>
                <div className="font-mono text-base font-bold text-cyan-400 mt-0.5">{stats.max.toLocaleString()}</div>
              </div>
              <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Min Value</span>
                <div className="font-mono text-base font-bold text-purple-400 mt-0.5">{stats.min.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
