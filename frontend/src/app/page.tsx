'use client';
import { useState, useEffect } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { PricePanel } from '@/components/PricePanel';
import { StockChart } from '@/components/StockChart';
import { NewsFeed } from '@/components/NewsFeed';
import { MarketSummary } from '@/components/MarketSummary';
import { WatchlistButton } from '@/components/WatchlistButton';
import { useFinnhubWS } from '@/hooks/useFinnhubWS';
import type { PriceData } from '@/types';
import type { LineData } from 'lightweight-charts';

export default function Home() {
  const [ticker, setTicker] = useState<string | null>(null);
  const [eodData, setEodData] = useState<PriceData | null>(null);
  const [eodLoading, setEodLoading] = useState(false);
  const [chartData, setChartData] = useState<LineData[]>([]);

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

    fetch(`/api/stock/quote?ticker=${ticker}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: PriceData | null) => {
        if (data) {
          setEodData(data);
          setChartData([{
            time: new Date().toISOString().split('T')[0] as `${number}-${number}-${number}`,
            value: data.today_close,
          }]);
        }
      })
      .catch(console.error)
      .finally(() => setEodLoading(false));
  }, [ticker]);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center gap-4">
        <span className="font-bold text-lg shrink-0">📈 StockInsight</span>
        <SearchBar onSearch={setTicker} />
        {ticker && <WatchlistButton ticker={ticker} />}
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
          <StockChart ticker={ticker} data={chartData} />
          <MarketSummary ticker={ticker} />
        </div>

        {/* Right 40% */}
        <div className="flex-[2] border-l border-zinc-200 dark:border-zinc-800 pl-4 flex flex-col">
          <h2 className="text-sm font-semibold text-zinc-500 mb-3">
            {ticker ? `📰 ${ticker} 뉴스` : '📰 뉴스'}
          </h2>
          <NewsFeed ticker={ticker} />
        </div>
      </main>
    </div>
  );
}
