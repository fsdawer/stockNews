import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  const upperTicker = ticker.toUpperCase();

  // 1. Supabase 캐시 우선
  const { data } = await supabase
    .from('news_cache')
    .select('id, ticker, headline_en, headline_ko, summary_ko, sentiment, source_url, published_at, translated_at')
    .eq('ticker', upperTicker)
    .order('published_at', { ascending: false })
    .limit(20);

  if (data && data.length > 0) {
    return NextResponse.json(data);
  }

  // 2. Supabase 비어있으면 Finnhub에서 직접 영어 뉴스 반환
  const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_KEY;
  if (!token) return NextResponse.json([]);

  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${upperTicker}&from=${from}&to=${to}&token=${token}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json([]);

    const raw = await res.json();
    if (!Array.isArray(raw)) return NextResponse.json([]);

    // Finnhub 뉴스를 news_cache 형식으로 변환 (번역 없이 영어 그대로)
    const items = raw
      .filter((n: { url?: string; headline?: string }) => n.url && n.headline)
      .sort((a: { datetime: number }, b: { datetime: number }) => b.datetime - a.datetime)
      .slice(0, 20)
      .map((n: { id?: number; headline: string; summary?: string; url: string; datetime: number }) => ({
        id: String(n.id ?? n.url),
        ticker: upperTicker,
        headline_en: n.headline,
        headline_ko: n.headline,       // 번역 전 영어 그대로
        summary_ko: n.summary ?? n.headline,
        sentiment: '중립',
        source_url: n.url,
        published_at: new Date(n.datetime * 1000).toISOString(),
        translated_at: null,
      }));

    return NextResponse.json(items);
  } catch {
    return NextResponse.json([]);
  }
}
