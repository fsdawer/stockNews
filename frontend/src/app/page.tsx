'use client';
import { useState, useEffect, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { SearchBar } from '@/components/SearchBar';
import { PricePanel } from '@/components/PricePanel';
import { StockChart } from '@/components/StockChart';
import { NewsFeed } from '@/components/NewsFeed';
import { MarketSummary } from '@/components/MarketSummary';
import { WatchlistButton } from '@/components/WatchlistButton';
import { WatchlistPanel } from '@/components/WatchlistPanel';
import { useFinnhubWS } from '@/hooks/useFinnhubWS';
import { useAuth } from '@/hooks/useAuth';
import type { PriceData } from '@/types';
import { type OHLCVPoint, type Timespan } from '@/components/StockChart';

export default function Home() {
  const [ticker, setTicker] = useState<string | null>(null);
  const [eodData, setEodData] = useState<PriceData | null>(null);
  const [eodLoading, setEodLoading] = useState(false);
  const [chartData, setChartData] = useState<OHLCVPoint[]>([]);
  const [timespan, setTimespan] = useState<Timespan>('D');
  const [watchlistOpen, setWatchlistOpen] = useState(false);

  const { user } = useAuth();
  const isLoggedIn = !!user;

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const trade = useFinnhubWS(ticker);

  const preMarketChangePct =
    trade && eodData
      ? ((trade.price - eodData.prev_close) / eodData.prev_close) * 100
      : null;

  useEffect(() => {
    if (!ticker) return;
    setEodLoading(true);
    setEodData(null);
    setChartData([]);

    Promise.all([
      fetch(`/api/stock/quote?ticker=${ticker}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/stock/history?ticker=${ticker}&timespan=${timespan}`).then(r => r.ok ? r.json() : []),
    ])
      .then(([quote, history]: [PriceData | null, OHLCVPoint[]]) => {
        if (quote) setEodData(quote);
        if (Array.isArray(history) && history.length > 0) setChartData(history);
      })
      .catch(console.error)
      .finally(() => setEodLoading(false));
  }, [ticker]);

  function handleTimespanChange(ts: Timespan) {
    setTimespan(ts);
    if (!ticker) return;
    fetch(`/api/stock/history?ticker=${ticker}&timespan=${ts}`)
      .then(r => r.ok ? r.json() : [])
      .then((h: OHLCVPoint[]) => {
        if (Array.isArray(h) && h.length > 0) setChartData(h);
      })
      .catch(console.error);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setWatchlistOpen(false);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center gap-4">
        <span className="font-bold text-lg shrink-0">StockInsight</span>
        <SearchBar onSearch={setTicker} />
        {ticker && <WatchlistButton ticker={ticker} isLoggedIn={isLoggedIn} />}
        <div className="ml-auto flex items-center gap-2 shrink-0 relative">
          <button
            onClick={() => setWatchlistOpen(prev => !prev)}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            관심목록
          </button>
          {watchlistOpen && (
            <WatchlistPanel
              isLoggedIn={isLoggedIn}
              onSelectTicker={setTicker}
              onClose={() => setWatchlistOpen(false)}
            />
          )}
          {isLoggedIn ? (
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-full text-sm font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              로그아웃
            </button>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              로그인
            </Link>
          )}
        </div>
      </header>

      {/* Price Panels */}
      {ticker && (
        <div className="flex gap-4 px-6 py-4">
          <div>
            <p className="text-xs text-zinc-500 mb-1">프리마켓</p>
            <PricePanel
              label="실시간"
              price={trade?.price ?? null}
              changePct={preMarketChangePct}
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">전일 정규장</p>
            <PricePanel
              label="마감가"
              price={eodData?.today_close ?? null}
              changePct={eodData?.change_pct ?? null}
              loading={eodLoading}
            />
          </div>
        </div>
      )}

      {/* Main — Layout B: 60/40 */}
      <main className="flex px-6 pb-6 gap-0" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* Left 60% */}
        <div className="flex flex-col gap-4 flex-[3] min-w-0 pr-4">
          <StockChart ticker={ticker} data={chartData} timespan={timespan} onTimespanChange={handleTimespanChange} />
          <MarketSummary ticker={ticker} />
        </div>

        {/* Right 40% */}
        <div className="flex-[2] border-l border-zinc-200 dark:border-zinc-800 pl-4 flex flex-col">
          <h2 className="text-sm font-semibold text-zinc-500 mb-3">
            {ticker ? `${ticker} 뉴스` : '뉴스'}
          </h2>
          <NewsFeed ticker={ticker} />
        </div>
      </main>
    </div>
  );
}
