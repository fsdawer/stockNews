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
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      if (inList) {
        const res = await fetch(`/api/watchlist?ticker=${ticker}`, { method: 'DELETE' });
        if (res.ok) {
          setInList(false);
        } else {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `오류 (${res.status})`);
          setInList(prev);
        }
      } else {
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, company_name: companyName }),
        });
        if (res.ok) {
          setInList(true);
        } else {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `오류 (${res.status})`);
          setInList(prev);
        }
      }
    } catch {
      setInList(prev);
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        onClick={toggle}
        disabled={loading}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-60 ${
          inList
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 hover:bg-yellow-200'
            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200'
        }`}
      >
        {loading ? '...' : inList ? '★ 관심 종목' : '☆ 관심 추가'}
      </button>
      {error && <span className="text-xs text-red-500 px-1">{error}</span>}
    </div>
  );
}
