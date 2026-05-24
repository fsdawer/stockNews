import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 뉴스는 공개 데이터 — anon key 사용 (service_role 불필요)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('news_cache')
    .select('id, ticker, headline_en, headline_ko, summary_ko, sentiment, source_url, published_at, translated_at')
    .eq('ticker', ticker.toUpperCase())
    .not('translated_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
