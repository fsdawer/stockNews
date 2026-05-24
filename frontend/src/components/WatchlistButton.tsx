'use client';
import { useState, useEffect } from 'react';

interface WatchlistButtonProps {
  ticker: string;
  companyName?: string;
}

export function WatchlistButton({ ticker, companyName }: WatchlistButtonProps) {
  const [inList, setInList] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/watchlist')
      .then(r => r.ok ? r.json() : [])
      .then((items: Array<{ ticker: string }>) => {
        setInList(items.some(i => i.ticker === ticker));
      })
      .catch(() => {});
  }, [ticker]);

  async function toggle() {
    setLoading(true);
    try {
      if (inList) {
        await fetch(`/api/watchlist?ticker=${ticker}`, { method: 'DELETE' });
        setInList(false);
      } else {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, company_name: companyName }),
        });
        setInList(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
        inList
          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 hover:bg-yellow-200'
          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200'
      }`}
    >
      {loading ? '...' : inList ? '★ 관심 종목' : '☆ 관심 추가'}
    </button>
  );
}
