import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { finnhub } from '@/lib/api/finnhub';
import { translateNewsBatch } from '@/lib/translate';


interface FinnhubNewsItem {
  id: number;
  headline: string;
  summary: string;
  url: string;
  datetime: number;
}

export async function POST(request: NextRequest) {
  const { ticker } = await request.json() as { ticker: string };
  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    svcKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const upperTicker = ticker.toUpperCase();

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const from = fromDate.toISOString().split('T')[0];
  const to = toDate.toISOString().split('T')[0];

  let rawNews: FinnhubNewsItem[];
  try {
    rawNews = await finnhub.companyNews(upperTicker, from, to) as FinnhubNewsItem[];
  } catch {
    return NextResponse.json({ error: 'Finnhub fetch failed' }, { status: 502 });
  }

  if (!rawNews || rawNews.length === 0) {
    return NextResponse.json({ translated: 0 });
  }

  // 최신순 10개만 — Gemini 무료 티어 RPM 제한(15회/분) 고려
  const candidates = rawNews
    .filter(n => n.url && n.headline)
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 10);

  const candidateUrls = candidates.map(n => n.url);
  const { data: existing, error: selectError } = await supabase
    .from('news_cache')
    .select('source_url, headline_en, headline_ko')
    .eq('ticker', upperTicker)
    .in('source_url', candidateUrls);

  if (selectError) {
    console.error('[translate] select error:', selectError.message);
  }

  // 이미 있어도 headline_ko가 영어 그대로인 경우 재번역 대상으로 포함
  const alreadyTranslatedUrls = new Set(
    (existing ?? [])
      .filter((r: { headline_en: string; headline_ko: string }) => r.headline_ko && r.headline_ko !== r.headline_en)
      .map((r: { source_url: string }) => r.source_url)
  );
  const newItems = candidates.filter(n => !alreadyTranslatedUrls.has(n.url));

  if (newItems.length === 0) {
    return NextResponse.json({ translated: 0 });
  }

  const BATCH_SIZE = 5;
  let translatedCount = 0;

  for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise(r => setTimeout(r, 2000)); // 배치 간 2초 대기 (RPM 제한 방어)
    const batch = newItems.slice(i, i + BATCH_SIZE);
    const inputs = batch.map((item) => ({
      headline: item.headline,
      summary: item.summary || item.headline,
    }));

    const results = await translateNewsBatch(inputs);

    const rows = batch.map((item, idx) => {
      const translated = results.find(r => r.index === idx + 1);
      return {
        ticker: upperTicker,
        headline_en: item.headline,
        headline_ko: translated?.headline_ko ?? item.headline,
        summary_ko: translated?.summary_ko ?? item.summary,
        sentiment: translated?.sentiment ?? '중립',
        source_url: item.url,
        published_at: new Date(item.datetime * 1000).toISOString(),
        translated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from('news_cache')
      .upsert(rows, { onConflict: 'ticker,source_url' });

    if (error) {
      console.error('[translate] upsert error:', error.message);
    } else {
      translatedCount += batch.length;
    }
  }

  return NextResponse.json({ translated: translatedCount });
}
