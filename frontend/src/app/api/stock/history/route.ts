import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

type Timespan = '1' | '5' | '15' | '60' | 'D' | 'W' | 'M';

interface OHLCVPoint {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface FmpBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function getPolygonParams(timespan: '1' | '5' | '15' | '60') {
  switch (timespan) {
    case '1':  return { mult: 1,  span: 'minute', daysBack: 2,  limit: 390, rev: 60 };
    case '5':  return { mult: 5,  span: 'minute', daysBack: 5,  limit: 300, rev: 60 };
    case '15': return { mult: 15, span: 'minute', daysBack: 7,  limit: 300, rev: 300 };
    case '60': return { mult: 60, span: 'minute', daysBack: 14, limit: 200, rev: 900 };
  }
}

function aggregateWeekly(daily: FmpBar[]): OHLCVPoint[] {
  const buckets = new Map<string, FmpBar[]>();
  for (const bar of daily) {
    const d = new Date(bar.date);
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
    const key = monday.toISOString().split('T')[0];
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(bar);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bars]) => ({
      time: key,
      open: bars[0].open,
      high: Math.max(...bars.map(b => b.high)),
      low: Math.min(...bars.map(b => b.low)),
      close: bars[bars.length - 1].close,
    }));
}

function aggregateMonthly(daily: FmpBar[]): OHLCVPoint[] {
  const buckets = new Map<string, FmpBar[]>();
  for (const bar of daily) {
    const key = bar.date.slice(0, 7); // YYYY-MM
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(bar);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bars]) => ({
      time: `${key}-01`,
      open: bars[0].open,
      high: Math.max(...bars.map(b => b.high)),
      low: Math.min(...bars.map(b => b.low)),
      close: bars[bars.length - 1].close,
    }));
}

async function fetchFmpDaily(ticker: string, apiKey: string): Promise<FmpBar[] | null> {
  const from = new Date(Date.now() - 1825 * 86400000).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];
  const url = `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${ticker}&from=${from}&to=${to}&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return (data as FmpBar[]).sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const timespan = (request.nextUrl.searchParams.get('timespan') ?? 'D') as Timespan;
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const upperTicker = ticker.toUpperCase();

  // 인트라데이: Polygon.io 유지
  if (['1', '5', '15', '60'].includes(timespan)) {
    const polygonKey = process.env.POLYGON_API_KEY;
    if (!polygonKey) return NextResponse.json({ error: 'POLYGON_API_KEY not configured' }, { status: 500 });

    const { mult, span, daysBack, limit, rev } = getPolygonParams(timespan as '1' | '5' | '15' | '60');
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0];
    const url = `https://api.polygon.io/v2/aggs/ticker/${upperTicker}/range/${mult}/${span}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}&apiKey=${polygonKey}`;
    const res = await fetch(url, { next: { revalidate: rev } });
    if (!res.ok) return NextResponse.json({ error: `Polygon error: ${res.status}` }, { status: 502 });
    const data = await res.json();
    if (!Array.isArray(data.results)) return NextResponse.json([]);
    type PolygonBar = { t: number; o: number; h: number; l: number; c: number };
    return NextResponse.json(data.results.map((r: PolygonBar) => ({
      time: r.t / 1000,
      open: r.o, high: r.h, low: r.l, close: r.c,
    })));
  }

  // 일봉/주봉/월봉: FMP (5년)
  const fmpKey = process.env.FMP_API_KEY;
  if (!fmpKey) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 500 });

  const daily = await fetchFmpDaily(upperTicker, fmpKey);
  if (!daily) return NextResponse.json({ error: 'FMP fetch failed' }, { status: 502 });

  if (timespan === 'W') return NextResponse.json(aggregateWeekly(daily));
  if (timespan === 'M') return NextResponse.json(aggregateMonthly(daily));
  return NextResponse.json(daily.map(b => ({ time: b.date, open: b.open, high: b.high, low: b.low, close: b.close })));
}
