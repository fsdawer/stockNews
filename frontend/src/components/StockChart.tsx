'use client';
import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts';

export interface OHLCVPoint {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type Timespan = '1' | '5' | '15' | '60' | 'D' | 'W' | 'M';

const TABS: { label: string; value: Timespan }[] = [
  { label: '1분', value: '1' },
  { label: '5분', value: '5' },
  { label: '15분', value: '15' },
  { label: '1시간', value: '60' },
  { label: '일봉', value: 'D' },
  { label: '주봉', value: 'W' },
  { label: '월봉', value: 'M' },
];

interface StockChartProps {
  ticker: string | null;
  data: OHLCVPoint[];
  timespan: Timespan;
  onTimespanChange: (ts: Timespan) => void;
}

export function StockChart({ ticker, data, timespan, onTimespanChange }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#71717a',
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      width: containerRef.current.clientWidth,
      height: 280,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const formatted = data.map(d => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })) as CandlestickData[];
      seriesRef.current.setData(formatted);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  return (
    <div className="w-full">
      {/* 시간대 탭 */}
      <div className="flex gap-1 mb-2">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => onTimespanChange(tab.value)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              timespan === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative w-full rounded-xl overflow-hidden">
        <div ref={containerRef} className="w-full" />
        {!ticker && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-400 text-sm">
            종목을 검색하세요
          </div>
        )}
      </div>
    </div>
  );
}
