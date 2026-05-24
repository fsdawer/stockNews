'use client';
import { useEffect, useState } from 'react';
import { NewsCard } from './NewsCard';
import type { NewsItem } from '@/types';

interface NewsFeedProps {
  ticker: string | null;
}

export function NewsFeed({ ticker }: NewsFeedProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!ticker) {
      setNews([]);
      return;
    }

    async function fetchNews() {
      setLoading(true);
      try {
        const res = await fetch(`/api/news?ticker=${ticker}`);
        const data: NewsItem[] = await res.json();

        if (data.length === 0) {
          setTranslating(true);
          try {
            await fetch('/api/news/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker }),
            });
            const res2 = await fetch(`/api/news?ticker=${ticker}`);
            const data2: NewsItem[] = await res2.json();
            setNews(data2);
          } catch {
            // translate failed — show empty state, not a crash
            setNews([]);
          } finally {
            setTranslating(false);
          }
        } else {
          setNews(data);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [ticker]);

  if (!ticker) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
        종목을 검색하면 뉴스가 표시됩니다
      </div>
    );
  }

  if (loading || translating) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
        {translating ? '뉴스 번역 중...' : '뉴스 불러오는 중...'}
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
        최근 뉴스 없음
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1">
      {news.map(item => <NewsCard key={item.id} item={item} />)}
    </div>
  );
}
