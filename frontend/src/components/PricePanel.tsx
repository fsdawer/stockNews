'use client';

interface PricePanelProps {
  label: string;
  price: number | null;
  changePct: number | null;
  loading?: boolean;
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function PricePanel({ label, price, changePct, loading }: PricePanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse w-40">
        <div className="h-4 w-20 bg-zinc-300 dark:bg-zinc-600 rounded" />
        <div className="h-8 w-28 bg-zinc-300 dark:bg-zinc-600 rounded" />
      </div>
    );
  }

  const color = changePct === null
    ? 'text-zinc-500'
    : changePct >= 0
      ? 'text-green-500'
      : 'text-red-500';

  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 min-w-40">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">
        {price !== null ? `$${price.toFixed(2)}` : '—'}
      </span>
      <span className={`text-sm font-medium ${color}`}>
        {changePct !== null ? formatPct(changePct) : '—'}
      </span>
    </div>
  );
}
