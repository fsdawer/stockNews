'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
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

interface StockProfile {
  name: string;
  logo: string | null;
  exchange: string | null;
}

export default function Home() {
  const [ticker, setTicker] = useState<string | null>(null);
  const [profile, setProfile] = useState<StockProfile | null>(null);
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
    if (!ticker) {
      setProfile(null);
      return;
    }
    setEodLoading(true);
    setEodData(null);
    setChartData([]);
    setProfile(null);

    Promise.all([
      fetch(`/api/stock/quote?ticker=${ticker}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/stock/history?ticker=${ticker}&timespan=${timespan}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/stock/profile?ticker=${ticker}`).then(r => r.ok ? r.json() : null),
    ])
      .then(([quote, history, prof]: [PriceData | null, OHLCVPoint[], StockProfile | null]) => {
        if (quote) setEodData(quote);
        if (Array.isArray(history) && history.length > 0) setChartData(history);
        if (prof) setProfile(prof);
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

      {/* 종목 헤더 — 로고 + 이름 + 가격 */}
      {ticker && (
        <div className="flex items-center gap-6 px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          {/* 로고 + 이름 */}
          <div className="flex items-center gap-3 min-w-0">
            {profile?.logo ? (
              <Image
                src={profile.logo}
                alt={profile.name}
                width={40}
                height={40}
                className="rounded-lg object-contain bg-white border border-zinc-200 dark:border-zinc-700 p-0.5 shrink-0"
                unoptimized
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-zinc-500">{ticker.slice(0, 2)}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-base truncate">{profile?.name ?? ticker}</p>
              <p className="text-xs text-zinc-400">{ticker}{profile?.exchange ? ` · ${profile.exchange}` : ''}</p>
            </div>
          </div>

          {/* 가격 패널 */}
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">프리마켓</p>
              <PricePanel label="실시간" price={trade?.price ?? null} changePct={preMarketChangePct} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">전일 정규장</p>
              <PricePanel label="마감가" price={eodData?.today_close ?? null} changePct={eodData?.change_pct ?? null} loading={eodLoading} />
            </div>
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
            {ticker ? `${profile?.name ?? ticker} 뉴스` : '뉴스'}
          </h2>
          <NewsFeed ticker={ticker} />
        </div>
      </main>
    </div>
  );
}
