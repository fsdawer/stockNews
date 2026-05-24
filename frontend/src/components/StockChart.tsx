'use client';
import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from 'lightweight-charts';

interface StockChartProps {
  ticker: string | null;
  data: LineData[];
}

export function StockChart({ ticker, data }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

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

    // v5 API: addSeries(LineSeries, options) replaces addLineSeries(options)
    const series = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
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
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  if (!ticker) {
    return (
      <div className="flex items-center justify-center h-72 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-sm">
        종목을 검색하세요
      </div>
    );
  }

  return <div ref={containerRef} className="w-full rounded-xl overflow-hidden" />;
}
