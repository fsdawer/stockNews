import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${process.env.FINNHUB_API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);

    const q = await res.json();
    // c=현재가, pc=전일종가, dp=등락률(%)
    if (!q.c) throw new Error('No quote data');

    return NextResponse.json({
      today_close: q.c,
      prev_close: q.pc,
      change_pct: q.dp,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'quote error' },
      { status: 502 }
    );
  }
}
