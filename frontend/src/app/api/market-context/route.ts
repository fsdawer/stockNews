import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { MarketContext, Sentiment, Volatility } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  const match = text.match(/```json\n?([\s\S]*?)\n?```/) ?? text.match(/(\{[\s\S]*\})/);
  return match ? match[1] ?? match[0] : text;
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const { data, error } = await supabase
    .from('market_context')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .single();

  if (error || !data) return NextResponse.json(null);
  return NextResponse.json(data as MarketContext);
}

export async function POST(request: NextRequest) {
  const { ticker } = await request.json() as { ticker: string };
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const upperTicker = ticker.toUpperCase();

  const { data: newsItems } = await supabase
    .from('news_cache')
    .select('headline_ko, summary_ko, sentiment')
    .eq('ticker', upperTicker)
    .not('translated_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(15);

  if (!newsItems || newsItems.length === 0) {
    return NextResponse.json({ error: 'no news to analyze' }, { status: 422 });
  }

  const bullish = newsItems.filter((n: { sentiment: Sentiment }) => n.sentiment === '호재').length;
  const bearish = newsItems.filter((n: { sentiment: Sentiment }) => n.sentiment === '악재').length;

  const newsText = newsItems
    .map((n: { headline_ko: string; summary_ko: string }) => `- ${n.headline_ko}: ${n.summary_ko}`)
    .join('\n');

  const prompt = `다음은 ${upperTicker} 최근 뉴스입니다:\n${newsText}\n\nJSON으로만 반환:\n{"rate_impact":"금리 영향 한 줄","oil_impact":"유가 영향 한 줄","volatility":"높음 또는 보통 또는 낮음","summary_ko":"전체 시장 상황 2-3문장"}`;

  let analysis: { rate_impact: string; oil_impact: string; volatility: Volatility; summary_ko: string };
  try {
    const text = await callGemini(prompt);
    analysis = JSON.parse(text);
  } catch (err) {
    console.error('[market-context] Gemini analysis failed:', err);
    analysis = { rate_impact: '분석 불가', oil_impact: '분석 불가', volatility: '보통', summary_ko: '분석 실패' };
  }

  const { error } = await supabase
    .from('market_context')
    .upsert({
      ticker: upperTicker,
      bullish_count: bullish,
      bearish_count: bearish,
      ...analysis,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ticker' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ticker: upperTicker, bullish_count: bullish, bearish_count: bearish, ...analysis });
}
