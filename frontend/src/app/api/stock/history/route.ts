import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

type Timespan = '1' | '5' | '15' | '60' | 'D' | 'W' | 'M';

function getPolygonParams(timespan: Timespan) {
  switch (timespan) {
    case '1':  return { mult: 1,  span: 'minute', daysBack: 2,   limit: 390, rev: 60 };
    case '5':  return { mult: 5,  span: 'minute', daysBack: 5,   limit: 300, rev: 60 };
    case '15': return { mult: 15, span: 'minute', daysBack: 7,   limit: 300, rev: 300 };
    case '60': return { mult: 60, span: 'minute', daysBack: 14,  limit: 200, rev: 900 };
    case 'W':  return { mult: 1,  span: 'week',   daysBack: 180, limit: 26,  rev: 3600 };
    case 'M':  return { mult: 1,  span: 'month',  daysBack: 365, limit: 12,  rev: 3600 };
    default:   return { mult: 1,  span: 'day',    daysBack: 90,  limit: 90,  rev: 3600 };
  }
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const timespan = (request.nextUrl.searchParams.get('timespan') ?? 'D') as Timespan;
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'POLYGON_API_KEY not configured' }, { status: 500 });

  const { mult, span, daysBack, limit, rev } = getPolygonParams(timespan);
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0];
  const isIntraday = ['1', '5', '15', '60'].includes(timespan);

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker.toUpperCase()}/range/${mult}/${span}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}&apiKey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: rev } });

  if (!res.ok) return NextResponse.json({ error: `Polygon error: ${res.status}` }, { status: 502 });

  const data = await res.json();
  if (!Array.isArray(data.results)) return NextResponse.json([]);

  type PolygonBar = { t: number; o: number; h: number; l: number; c: number };
  const points = data.results.map((r: PolygonBar) => ({
    time: isIntraday ? r.t / 1000 : new Date(r.t).toISOString().split('T')[0],
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
  }));

  return NextResponse.json(points);
}
