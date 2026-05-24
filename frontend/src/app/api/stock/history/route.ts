import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'POLYGON_API_KEY not configured' }, { status: 500 });

  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker.toUpperCase()}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=30&apiKey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) return NextResponse.json({ error: `Polygon error: ${res.status}` }, { status: 502 });

  const data = await res.json();
  if (!Array.isArray(data.results)) return NextResponse.json([]);

  const points = data.results.map((r: { t: number; c: number }) => ({
    time: new Date(r.t).toISOString().split('T')[0],
    value: r.c,
  }));

  return NextResponse.json(points);
}
