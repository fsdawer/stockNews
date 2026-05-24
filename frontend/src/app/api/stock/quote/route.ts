import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  try {
    const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_KEY;
    if (!token) throw new Error('FINNHUB_API_KEY not configured');

    const url = `https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${token}`;
    const res = await fetch(url, { cache: 'no-store' }); // 캐시 금지 — 0 응답 캐시 방지
    if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);

    const q = await res.json();
    // c=현재가, pc=전일종가, dp=등락률(%) / 401이면 c,pc 모두 0
    if (q.c === undefined || (q.c === 0 && q.pc === 0)) throw new Error('No quote data — check API key or ticker');

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
