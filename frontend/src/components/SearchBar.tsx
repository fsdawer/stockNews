'use client';
import { useEffect, useRef, useState } from 'react';

interface SearchResult {
  ticker: string;
  name: string;
}

interface SearchBarProps {
  onSearch: (ticker: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = input.trim();
    if (!q) { setResults([]); setOpen(false); return; }

    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setResults(data);
          setOpen(true);
        } else {
          setResults([]);
          setOpen(false);
        }
      } catch {
        setResults([]);
      }
    }, 300);
  }, [input]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function select(ticker: string) {
    setInput(ticker);
    setOpen(false);
    onSearch(ticker);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim().toUpperCase();
    if (trimmed) { setOpen(false); onSearch(trimmed); }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder="종목 검색 (예: AAPL, 테슬라, Tesla)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="flex-1 px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <button
          type="submit"
          className="px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          검색
        </button>
      </form>

      {open && results.length > 0 && (
        <ul className="absolute top-full mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-50 overflow-hidden">
          {results.map(r => (
            <li key={r.ticker}>
              <button
                type="button"
                onClick={() => select(r.ticker)}
                className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex justify-between items-center text-sm"
              >
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{r.ticker}</span>
                <span className="text-zinc-500 truncate ml-4">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
