import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { finnhub } from '@/lib/api/finnhub';
import { translateNewsBatch } from '@/lib/translate';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  const urls = rawNews.map(n => n.url).filter(Boolean);
  const { data: existing } = await supabase
    .from('news_cache')
    .select('source_url')
    .eq('ticker', upperTicker)
    .in('source_url', urls);

  const existingUrls = new Set((existing ?? []).map((r: { source_url: string }) => r.source_url));
  const newItems = rawNews
    .filter(n => n.url && !existingUrls.has(n.url))
    .slice(0, 20);

  if (newItems.length === 0) {
    return NextResponse.json({ translated: 0 });
  }

  const BATCH_SIZE = 5;
  let translatedCount = 0;

  for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
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

    if (!error) translatedCount += batch.length;
  }

  return NextResponse.json({ translated: translatedCount });
}
