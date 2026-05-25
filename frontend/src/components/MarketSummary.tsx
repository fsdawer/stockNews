'use client';
import { useEffect, useState } from 'react';
import type { MarketContext, Volatility } from '@/types';

interface MarketSummaryProps {
  ticker: string | null;
}

const volatilityLabel: Record<Volatility, string> = {
  '높음': '변동성↑',
  '보통': '변동성→',
  '낮음': '변동성↓',
};

export function MarketSummary({ ticker }: MarketSummaryProps) {
  const [ctx, setCtx] = useState<MarketContext | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) {
      setCtx(null);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/market-context?ticker=${ticker}`);
        const raw = res.ok ? await res.json() : null;
        // summary_ko가 '분석 실패'면 재분석 필요
        const isStale = raw?.summary_ko === '분석 실패' || raw?.summary_ko === null;
        let data: MarketContext | null = (raw && typeof raw === 'object' && !Array.isArray(raw) && !raw.error && !isStale) ? raw : null;

        if (!data) {
          const postRes = await fetch('/api/market-context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker }),
          });
          if (postRes.ok) data = await postRes.json();
        }

        setCtx(data);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [ticker]);

  if (!ticker) return null;

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse">
        <div className="h-4 w-48 bg-zinc-300 dark:bg-zinc-600 rounded mb-2" />
        <div className="h-4 w-full bg-zinc-300 dark:bg-zinc-600 rounded" />
      </div>
    );
  }

  if (!ctx) return null;

  return (
    <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800">
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          호재 {ctx.bullish_count}
        </span>
        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
          악재 {ctx.bearish_count}
        </span>
        {ctx.rate_impact && (
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            금리: {ctx.rate_impact}
          </span>
        )}
        {ctx.oil_impact && (
          <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
            유가: {ctx.oil_impact}
          </span>
        )}
        {ctx.volatility && (
          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
            {volatilityLabel[ctx.volatility]}
          </span>
        )}
      </div>
      {ctx.summary_ko && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{ctx.summary_ko}</p>
      )}
    </div>
  );
}
