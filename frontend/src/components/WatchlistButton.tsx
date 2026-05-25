'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface WatchlistButtonProps {
  ticker: string;
  companyName?: string;
  isLoggedIn: boolean;
}

export function WatchlistButton({ ticker, companyName, isLoggedIn }: WatchlistButtonProps) {
  const router = useRouter();
  const [inList, setInList] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch('/api/watchlist')
      .then(r => r.ok ? r.json() : [])
      .then((items: Array<{ ticker: string }>) => {
        setInList(items.some(i => i.ticker === ticker));
      })
      .catch(() => {});
  }, [ticker, isLoggedIn]);

  async function toggle() {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    const prev = inList;
    setLoading(true);
    try {
      if (inList) {
        const res = await fetch(`/api/watchlist?ticker=${ticker}`, { method: 'DELETE' });
        if (res.ok) setInList(false);
      } else {
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, company_name: companyName }),
        });
        if (res.ok) setInList(true);
      }
    } catch {
      setInList(prev);
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
