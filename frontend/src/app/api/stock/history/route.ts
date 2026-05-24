import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=1d&range=1mo`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return NextResponse.json({ error: `Yahoo error: ${res.status}` }, { status: 502 });

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return NextResponse.json([]);

  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

  const points = timestamps
    .map((t: number, i: number) => ({
      time: new Date(t * 1000).toISOString().split('T')[0],
      value: closes[i],
    }))
    .filter((p: { time: string; value: number }) => p.value != null);

  return NextResponse.json(points);
}
