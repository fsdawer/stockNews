'use client';
import { useEffect, useState } from 'react';
import type { WatchlistItem } from '@/types';

interface WatchlistPanelProps {
  isLoggedIn: boolean;
  onSelectTicker: (ticker: string) => void;
  onClose: () => void;
}

export function WatchlistPanel({ isLoggedIn, onSelectTicker, onClose }: WatchlistPanelProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    fetch('/api/watchlist')
      .then(r => r.ok ? r.json() : [])
      .then((data: WatchlistItem[]) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-50 p-4">
        <p className="text-sm text-zinc-500 text-center">로그인 후 관심 종목을 확인하세요</p>
        <a href="/login" className="block mt-2 text-center text-sm text-blue-600 hover:underline">로그인하기</a>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">관심 종목</span>
      </div>
      {loading ? (
        <div className="p-4 text-sm text-zinc-400 text-center">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="p-4 text-sm text-zinc-400 text-center">관심 종목 없음</div>
      ) : (
        <ul>
          {items.map(item => (
            <li key={item.id}>
              <button
                onClick={() => { onSelectTicker(item.ticker); onClose(); }}
                className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex justify-between items-center"
              >
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{item.ticker}</span>
                {item.company_name && (
                  <span className="text-xs text-zinc-400 truncate ml-2">{item.company_name}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
