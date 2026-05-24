import type { NewsItem, Sentiment } from '@/types';

function SentimentBadge({ sentiment }: { sentiment: Sentiment | null }) {
  const styles: Record<Sentiment, string> = {
    '호재': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    '악재': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    '중립': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400',
  };
  if (!sentiment) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[sentiment]}`}>
      {sentiment}
    </span>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.source_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0"
    >
      <div className="flex items-start gap-2 mb-1">
        <SentimentBadge sentiment={item.sentiment} />
        <span className="text-xs text-zinc-400 ml-auto shrink-0">
          {timeAgo(item.published_at)}
        </span>
      </div>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
        {item.headline_ko ?? item.headline_en}
      </p>
      {item.summary_ko && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
          {item.summary_ko}
        </p>
      )}
    </a>
  );
}
