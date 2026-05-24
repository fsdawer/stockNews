import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_KEY;
  if (!token) return NextResponse.json({ error: 'no api key' }, { status: 500 });

  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 60 * 24 * 30; // 30일

  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${ticker.toUpperCase()}&resolution=D&from=${from}&to=${to}&token=${token}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return NextResponse.json({ error: `Finnhub error: ${res.status}` }, { status: 502 });

  const data = await res.json();
  if (data.s !== 'ok' || !Array.isArray(data.t)) {
    return NextResponse.json([]);
  }

  // lightweight-charts LineData 형식으로 변환
  const points = data.t.map((t: number, i: number) => ({
    time: new Date(t * 1000).toISOString().split('T')[0],
    value: data.c[i],
  }));

  return NextResponse.json(points);
}
