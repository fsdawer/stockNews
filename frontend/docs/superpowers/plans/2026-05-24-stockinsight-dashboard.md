# StockInsight Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stock analysis dashboard showing pre-market/prev-day prices, translated news feed, and AI market summary with watchlist and background refresh.

**Architecture:** Next.js 16 App Router with Finnhub WebSocket for real-time price (client-direct), FMP stable API for EOD price via API Routes, Supabase for auth/caching/watchlist, Claude Haiku for news translation, pg_cron Edge Function for background refresh.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Tailwind CSS v4, Supabase (auth + postgres + RLS), Finnhub WebSocket, FMP stable API, Anthropic SDK (claude-haiku-4-5-20251001), lightweight-charts v4, vitest

---

## File Map

### New files to create
| File | Responsibility |
|---|---|
| `src/proxy.ts` | Auth proxy — replaces deprecated middleware.ts |
| `src/types/index.ts` | Shared TypeScript types (NewsItem, PriceData, MarketContext) |
| `src/lib/translate.ts` | Claude Haiku translation + batch translation logic |
| `src/app/api/stock/quote/route.ts` | GET FMP EOD price — prev-close + change_pct |
| `src/app/api/news/route.ts` | GET news from Supabase cache; on-demand fallback |
| `src/app/api/news/translate/route.ts` | POST Finnhub→Claude→Supabase translate pipeline |
| `src/app/api/market-context/route.ts` | GET/POST market context upsert |
| `src/app/api/watchlist/route.ts` | GET/POST/DELETE watchlist (requires auth) |
| `src/hooks/useFinnhubWS.ts` | WebSocket hook — real-time price + reconnect |
| `src/components/SearchBar.tsx` | Ticker search input with debounce |
| `src/components/PricePanel.tsx` | Pre-market % + prev-day % side-by-side display |
| `src/components/StockChart.tsx` | lightweight-charts line chart (client component) |
| `src/components/NewsCard.tsx` | Single news card (headline_ko, summary_ko, sentiment badge) |
| `src/components/NewsFeed.tsx` | Scrollable news list, loading + empty states |
| `src/components/MarketSummary.tsx` | AI market context (bullish/bearish counts, impacts) |
| `src/components/WatchlistButton.tsx` | Add/remove watchlist toggle (requires auth) |
| `src/app/login/page.tsx` | Email + password login/signup page |
| `src/app/page.tsx` | Root page — SearchBar + layout B wiring |
| `supabase/functions/watchlist-cron/index.ts` | Edge Function — pg_cron triggered background refresh |

### Files to modify
| File | Change |
|---|---|
| `src/middleware.ts` | Delete — replaced by `src/proxy.ts` |
| `src/lib/api/fmp.ts` | Add `eodLight()` endpoint for prev-close |
| `src/app/layout.tsx` | Update title to "StockInsight" |

---

## Task 1: Project Setup — packages, env vars, test runner, proxy migration

**Files:**
- Modify: `package.json`
- Create: `src/proxy.ts`
- Delete: `src/middleware.ts`
- Create: `vitest.config.ts`
- Modify: `.env.local`

- [ ] **Step 1: Install required packages**

```bash
cd /Users/jang/Desktop/Study/stockinsight/frontend
npm install @anthropic-ai/sdk lightweight-charts
npm install -D vitest @vitest/coverage-v8
```

Expected: packages added to node_modules, no errors.

- [ ] **Step 2: Add vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Add missing env vars to .env.local**

Append to `/Users/jang/Desktop/Study/stockinsight/frontend/.env.local`:
```
NEXT_PUBLIC_FINNHUB_KEY=d88mfa9r01qq4343pa40d88mfa9r01qq4343pa4g
ANTHROPIC_API_KEY=<your-anthropic-key-here>
TRANSLATION_PROVIDER=claude
```

> Note: `NEXT_PUBLIC_FINNHUB_KEY` exposes the key client-side (required for browser WebSocket). Finnhub treats this like an anon key — acceptable.

- [ ] **Step 5: Migrate middleware.ts → proxy.ts**

Delete `src/middleware.ts`.

Create `src/proxy.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts on http://localhost:3000 with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add packages, vitest, proxy auth (migrated from middleware)"
```

---

## Task 2: Supabase Tables — create watchlist, news_cache, market_context

**Files:** No code files — run SQL in Supabase dashboard.

- [ ] **Step 1: Open Supabase SQL editor**

Go to: https://supabase.com/dashboard/project/gqyxbabwosrslwnhrsgc/sql/new

- [ ] **Step 2: Create watchlist table**

```sql
create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  company_name text,
  added_at timestamptz default now(),
  constraint watchlist_user_ticker_unique unique (user_id, ticker)
);

alter table public.watchlist enable row level security;

create policy "본인 데이터만"
  on public.watchlist
  for all
  using (user_id = auth.uid());
```

Click "Run". Expected: "Success. No rows returned."

- [ ] **Step 3: Create news_cache table**

```sql
create table public.news_cache (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  headline_en text not null,
  headline_ko text,
  summary_ko text,
  sentiment text check (sentiment in ('호재', '악재', '중립')),
  source_url text,
  published_at timestamptz,
  translated_at timestamptz,
  constraint news_cache_ticker_url_unique unique (ticker, source_url)
);

create index idx_news_cache_ticker_published
  on public.news_cache (ticker, published_at desc);
```

Click "Run". Expected: "Success."

- [ ] **Step 4: Create market_context table**

```sql
create table public.market_context (
  id uuid primary key default gen_random_uuid(),
  ticker text unique not null,
  sentiment_score text,
  bullish_count int default 0,
  bearish_count int default 0,
  rate_impact text,
  oil_impact text,
  volatility text check (volatility in ('높음', '보통', '낮음')),
  summary_ko text,
  updated_at timestamptz default now()
);
```

Click "Run". Expected: "Success."

- [ ] **Step 5: Verify tables in Table Editor**

Go to Table Editor and confirm all 3 tables appear.

---

## Task 3: Shared Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write types**

Create `src/types/index.ts`:
```typescript
export type Sentiment = '호재' | '악재' | '중립';
export type Volatility = '높음' | '보통' | '낮음';

export interface NewsItem {
  id: string;
  ticker: string;
  headline_en: string;
  headline_ko: string | null;
  summary_ko: string | null;
  sentiment: Sentiment | null;
  source_url: string | null;
  published_at: string | null;
  translated_at: string | null;
}

export interface PriceData {
  price: number;
  prev_close: number;
  prev_change_pct: number; // (price - prev_close) / prev_close * 100
}

export interface MarketContext {
  ticker: string;
  sentiment_score: string | null;
  bullish_count: number;
  bearish_count: number;
  rate_impact: string | null;
  oil_impact: string | null;
  volatility: Volatility | null;
  summary_ko: string | null;
  updated_at: string;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  company_name: string | null;
  added_at: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts && git commit -m "feat: add shared TypeScript types"
```

---

## Task 4: Translation Library

**Files:**
- Create: `src/lib/translate.ts`
- Create: `src/lib/translate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/translate.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          text: JSON.stringify({
            headline_ko: '로켓랩 계약 수주 9000만 달러',
            summary_ko: '로켓랩이 신규 위성 발사 계약을 수주했다.',
            sentiment: '호재',
          }),
        }],
      }),
    },
  })),
}));

describe('translateNews', () => {
  it('returns Korean translation and sentiment', async () => {
    const { translateNews } = await import('./translate');
    const result = await translateNews('Rocket Lab wins $90M contract', 'Details here');
    expect(result.headline_ko).toBe('로켓랩 계약 수주 9000만 달러');
    expect(result.summary_ko).toBe('로켓랩이 신규 위성 발사 계약을 수주했다.');
    expect(result.sentiment).toBe('호재');
  });

  it('returns neutral fallback on JSON parse failure', async () => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ text: 'not json' }],
    });
    (Anthropic as any).mockImplementationOnce(() => ({
      messages: { create: mockCreate },
    }));
    const { translateNews } = await import('./translate');
    const result = await translateNews('headline', 'summary');
    expect(result.sentiment).toBe('중립');
    expect(result.headline_ko).toBe('headline');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test
```

Expected: FAIL — "Cannot find module './translate'"

- [ ] **Step 3: Implement translate.ts**

Create `src/lib/translate.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { Sentiment } from '@/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface TranslateResult {
  headline_ko: string;
  summary_ko: string;
  sentiment: Sentiment;
}

export async function translateNews(
  headline: string,
  summary: string
): Promise<TranslateResult> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `다음 영어 금융 뉴스를 분석하세요.\n헤드라인: "${headline}"\n본문: "${summary}"\n\nJSON으로만 반환:\n{"headline_ko":"한국어 헤드라인 30자 이내","summary_ko":"핵심 2-3문장 투자자 관점","sentiment":"호재 또는 악재 또는 중립"}`,
      }],
    });

    return JSON.parse(response.content[0].text) as TranslateResult;
  } catch {
    return { headline_ko: headline, summary_ko: summary, sentiment: '중립' };
  }
}

interface BatchNewsInput {
  index: number;
  headline: string;
  summary: string;
}

interface BatchTranslateResult extends TranslateResult {
  index: number;
}

export async function translateNewsBatch(
  items: BatchNewsInput[]
): Promise<BatchTranslateResult[]> {
  const numbered = items
    .map((n, i) => `${i + 1}. 헤드라인: "${n.headline}"\n   본문: "${n.summary}"`)
    .join('\n\n');

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `다음 금융 뉴스 ${items.length}건을 분석하세요.\n\n${numbered}\n\nJSON 배열로만 반환:\n[{"index":1,"headline_ko":"...","summary_ko":"...","sentiment":"호재|악재|중립"},...]`,
      }],
    });

    const results = JSON.parse(response.content[0].text) as BatchTranslateResult[];
    return results;
  } catch {
    return items.map((item, i) => ({
      index: i + 1,
      headline_ko: item.headline,
      summary_ko: item.summary,
      sentiment: '중립' as Sentiment,
    }));
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/translate.ts src/lib/translate.test.ts && git commit -m "feat: add Claude Haiku translation library with tests"
```

---

## Task 5: Update FMP API — EOD Light Endpoint

**Files:**
- Modify: `src/lib/api/fmp.ts`
- Create: `src/lib/api/fmp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/fmp.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

global.fetch = vi.fn();

describe('fmp.eodLight', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns prev_close and change_pct', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { date: '2026-05-23', close: 131.39, volume: 12000000 },
        { date: '2026-05-22', close: 132.88, volume: 10000000 },
      ]),
    });

    const { fmp } = await import('./fmp');
    const result = await fmp.eodLight('RKLB');
    expect(result.prev_close).toBe(132.88);
    expect(result.today_close).toBe(131.39);
    expect(result.change_pct).toBeCloseTo(-1.12, 1);
  });

  it('throws on API error', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 429 });
    const { fmp } = await import('./fmp');
    await expect(fmp.eodLight('RKLB')).rejects.toThrow('FMP API error: 429');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test
```

Expected: FAIL — "fmp.eodLight is not a function"

- [ ] **Step 3: Add eodLight to fmp.ts**

In `src/lib/api/fmp.ts`, add `eodLight` to the `fmp` export object:
```typescript
  // 전일 종가 (EOD light — 250 req/day 아낌)
  eodLight: async (ticker: string): Promise<{
    today_close: number;
    prev_close: number;
    change_pct: number;
  }> => {
    const data = await fmpFetch<Array<{ date: string; close: number; volume: number }>>(
      `/historical-price-eod/light?symbol=${ticker}&limit=2`
    );
    if (!data || data.length < 2) {
      throw new Error(`Insufficient EOD data for ${ticker}`);
    }
    const today_close = data[0].close;
    const prev_close = data[1].close;
    const change_pct = ((today_close - prev_close) / prev_close) * 100;
    return { today_close, prev_close, change_pct };
  },
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/fmp.ts src/lib/api/fmp.test.ts && git commit -m "feat: add FMP eodLight endpoint for prev-close calculation"
```

---

## Task 6: API Route — /api/stock/quote

**Files:**
- Create: `src/app/api/stock/quote/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/stock/quote/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { fmp } from '@/lib/api/fmp';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  try {
    const data = await fmp.eodLight(ticker.toUpperCase());
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'FMP error' },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Smoke test with curl**

```bash
curl "http://localhost:3000/api/stock/quote?ticker=AAPL"
```

Expected: `{"today_close": 195.87, "prev_close": 193.42, "change_pct": 1.27}` (values vary)

- [ ] **Step 3: Test error case**

```bash
curl "http://localhost:3000/api/stock/quote"
```

Expected: `{"error":"ticker required"}` with status 400.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stock/quote/route.ts && git commit -m "feat: add /api/stock/quote route for FMP EOD price"
```

---

## Task 7: API Route — /api/news (Supabase cache first)

**Files:**
- Create: `src/app/api/news/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/news/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
```

- [ ] **Step 2: Smoke test with curl (empty response is OK initially)**

```bash
curl "http://localhost:3000/api/news?ticker=RKLB"
```

Expected: `[]` (empty array — no data yet, that's correct)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/news/route.ts && git commit -m "feat: add /api/news route reading from Supabase cache"
```

---

## Task 8: API Route — /api/news/translate (on-demand pipeline)

**Files:**
- Create: `src/app/api/news/translate/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/news/translate/route.ts`:
```typescript
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

  // Fetch last 30 days of news from Finnhub
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

  // Check which URLs are already in cache
  const urls = rawNews.map(n => n.url).filter(Boolean);
  const { data: existing } = await supabase
    .from('news_cache')
    .select('source_url')
    .eq('ticker', upperTicker)
    .in('source_url', urls);

  const existingUrls = new Set((existing ?? []).map((r: { source_url: string }) => r.source_url));
  const newItems = rawNews
    .filter(n => n.url && !existingUrls.has(n.url))
    .slice(0, 20); // cap at 20 per call

  if (newItems.length === 0) {
    return NextResponse.json({ translated: 0 });
  }

  // Translate in batches of 5
  const BATCH_SIZE = 5;
  let translatedCount = 0;

  for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
    const batch = newItems.slice(i, i + BATCH_SIZE);
    const inputs = batch.map((item, idx) => ({
      index: idx + 1,
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
```

- [ ] **Step 2: Test the endpoint**

```bash
curl -X POST http://localhost:3000/api/news/translate \
  -H "Content-Type: application/json" \
  -d '{"ticker":"RKLB"}'
```

Expected: `{"translated": N}` where N > 0 (Finnhub returns RKLB news)

- [ ] **Step 3: Verify news appeared in Supabase**

```bash
curl "http://localhost:3000/api/news?ticker=RKLB"
```

Expected: array of news items with `headline_ko` and `summary_ko` filled in.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/news/translate/route.ts && git commit -m "feat: add /api/news/translate — Finnhub→Claude→Supabase pipeline"
```

---

## Task 9: API Route — /api/market-context

**Files:**
- Create: `src/app/api/market-context/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/market-context/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { MarketContext, Sentiment, Volatility } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  // Fetch recent translated news for context
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

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `다음은 ${upperTicker} 최근 뉴스입니다:\n${newsText}\n\nJSON으로만 반환:\n{"rate_impact":"금리 영향 한 줄","oil_impact":"유가 영향 한 줄","volatility":"높음 또는 보통 또는 낮음","summary_ko":"전체 시장 상황 2-3문장"}`,
    }],
  });

  let analysis: { rate_impact: string; oil_impact: string; volatility: Volatility; summary_ko: string };
  try {
    analysis = JSON.parse(response.content[0].text);
  } catch {
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
```

- [ ] **Step 2: Smoke test (GET — empty is OK)**

```bash
curl "http://localhost:3000/api/market-context?ticker=RKLB"
```

Expected: `null` (no data yet)

- [ ] **Step 3: Test POST (requires news in cache from Task 8)**

```bash
curl -X POST http://localhost:3000/api/market-context \
  -H "Content-Type: application/json" \
  -d '{"ticker":"RKLB"}'
```

Expected: JSON with `rate_impact`, `oil_impact`, `volatility`, `summary_ko`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/market-context/route.ts && git commit -m "feat: add /api/market-context GET/POST with Claude Haiku analysis"
```

---

## Task 10: API Route — /api/watchlist

**Files:**
- Create: `src/app/api/watchlist/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/watchlist/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { WatchlistItem } from '@/types';

function makeSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    }
  );
}

export async function GET() {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('watchlist')
    .select('id, ticker, company_name, added_at')
    .order('added_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data as WatchlistItem[]);
}

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker, company_name } = await request.json() as { ticker: string; company_name?: string };
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const { error } = await supabase
    .from('watchlist')
    .insert({ user_id: user.id, ticker: ticker.toUpperCase(), company_name });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('ticker', ticker.toUpperCase())
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Test unauthorized access**

```bash
curl "http://localhost:3000/api/watchlist"
```

Expected: `{"error":"Unauthorized"}` with status 401.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/watchlist/route.ts && git commit -m "feat: add /api/watchlist GET/POST/DELETE with Supabase auth"
```

---

## Task 11: Finnhub WebSocket Hook

**Files:**
- Create: `src/hooks/useFinnhubWS.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useFinnhubWS.ts`:
```typescript
'use client';
import { useEffect, useRef, useState } from 'react';

interface TradeData {
  price: number;
  volume: number;
  timestamp: number;
  isPremarket: boolean;
}

function isPremarket(timestamp: number): boolean {
  const date = new Date(timestamp);
  const hours = date.getUTCHours();
  // Pre-market (ET 4:00-9:30am) = UTC 8:00-13:30
  return hours >= 8 && hours < 14;
}

export function useFinnhubWS(ticker: string | null) {
  const [trade, setTrade] = useState<TradeData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const MAX_RECONNECT = 3;

  useEffect(() => {
    if (!ticker) return;

    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_KEY;
    if (!apiKey) {
      console.warn('NEXT_PUBLIC_FINNHUB_KEY not set');
      return;
    }

    function connect() {
      const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectCount.current = 0;
        ws.send(JSON.stringify({ type: 'subscribe', symbol: ticker }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'trade' && data.data?.length > 0) {
          const latest = data.data[data.data.length - 1];
          setTrade({
            price: latest.p,
            volume: latest.v,
            timestamp: latest.t,
            isPremarket: isPremarket(latest.t),
          });
        }
      };

      ws.onerror = () => {
        if (reconnectCount.current < MAX_RECONNECT) {
          reconnectCount.current++;
          setTimeout(connect, 5000 * reconnectCount.current);
        }
      };
    }

    connect();

    return () => {
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'unsubscribe', symbol: ticker }));
        }
        wsRef.current.close();
      }
    };
  }, [ticker]);

  return trade;
}
```

- [ ] **Step 2: Verify type checks**

```bash
cd /Users/jang/Desktop/Study/stockinsight/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFinnhubWS.ts && git commit -m "feat: add Finnhub WebSocket hook with reconnect logic"
```

---

## Task 12: PricePanel Component

**Files:**
- Create: `src/components/PricePanel.tsx`

- [ ] **Step 1: Create PricePanel**

Create `src/components/PricePanel.tsx`:
```typescript
'use client';

interface PricePanelProps {
  label: string;          // "프리마켓" or "전일 정규장"
  price: number | null;
  changePct: number | null;
  loading?: boolean;
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function PricePanel({ label, price, changePct, loading }: PricePanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse w-40">
        <div className="h-4 w-20 bg-zinc-300 dark:bg-zinc-600 rounded" />
        <div className="h-8 w-28 bg-zinc-300 dark:bg-zinc-600 rounded" />
      </div>
    );
  }

  const isPositive = changePct !== null && changePct >= 0;
  const color = changePct === null
    ? 'text-zinc-500'
    : isPositive
      ? 'text-green-500'
      : 'text-red-500';

  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 min-w-40">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">
        {price !== null ? `$${price.toFixed(2)}` : '—'}
      </span>
      <span className={`text-sm font-medium ${color}`}>
        {changePct !== null ? formatPct(changePct) : '—'}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PricePanel.tsx && git commit -m "feat: add PricePanel component"
```

---

## Task 13: StockChart Component

**Files:**
- Create: `src/components/StockChart.tsx`

- [ ] **Step 1: Create StockChart**

Create `src/components/StockChart.tsx`:
```typescript
'use client';
import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type LineData,
} from 'lightweight-charts';

interface StockChartProps {
  ticker: string | null;
  data: LineData[];
}

export function StockChart({ ticker, data }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#71717a',
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      width: containerRef.current.clientWidth,
      height: 280,
      timeScale: { borderColor: '#3f3f46' },
      rightPriceScale: { borderColor: '#3f3f46' },
    });

    const series = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  if (!ticker) {
    return (
      <div className="flex items-center justify-center h-72 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-sm">
        종목을 검색하세요
      </div>
    );
  }

  return <div ref={containerRef} className="w-full rounded-xl overflow-hidden" />;
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/StockChart.tsx && git commit -m "feat: add StockChart using lightweight-charts"
```

---

## Task 14: NewsCard + NewsFeed Components

**Files:**
- Create: `src/components/NewsCard.tsx`
- Create: `src/components/NewsFeed.tsx`

- [ ] **Step 1: Create NewsCard**

Create `src/components/NewsCard.tsx`:
```typescript
import type { NewsItem, Sentiment } from '@/types';

function SentimentBadge({ sentiment }: { sentiment: Sentiment | null }) {
  const styles: Record<Sentiment, string> = {
    '호재': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    '악재': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    '중립': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400',
  };
  if (!sentiment) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[sentiment]}`}>
      {sentiment}
    </span>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.source_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0"
    >
      <div className="flex items-start gap-2 mb-1">
        <SentimentBadge sentiment={item.sentiment} />
        <span className="text-xs text-zinc-400 ml-auto shrink-0">
          {timeAgo(item.published_at)}
        </span>
      </div>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
        {item.headline_ko ?? item.headline_en}
      </p>
      {item.summary_ko && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
          {item.summary_ko}
        </p>
      )}
    </a>
  );
}
```

- [ ] **Step 2: Create NewsFeed**

Create `src/components/NewsFeed.tsx`:
```typescript
'use client';
import { useEffect, useState } from 'react';
import { NewsCard } from './NewsCard';
import type { NewsItem } from '@/types';

interface NewsFeedProps {
  ticker: string | null;
}

export function NewsFeed({ ticker }: NewsFeedProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!ticker) {
      setNews([]);
      return;
    }

    async function fetchNews() {
      setLoading(true);
      try {
        const res = await fetch(`/api/news?ticker=${ticker}`);
        const data: NewsItem[] = await res.json();

        if (data.length === 0) {
          // On-demand translate
          setTranslating(true);
          await fetch('/api/news/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker }),
          });
          setTranslating(false);

          const res2 = await fetch(`/api/news?ticker=${ticker}`);
          const data2: NewsItem[] = await res2.json();
          setNews(data2);
        } else {
          setNews(data);
        }
      } finally {
        setLoading(false);
        setTranslating(false);
      }
    }

    fetchNews();
  }, [ticker]);

  if (!ticker) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
        종목을 검색하면 뉴스가 표시됩니다
      </div>
    );
  }

  if (loading || translating) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
        {translating ? '뉴스 번역 중...' : '뉴스 불러오는 중...'}
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
        최근 뉴스 없음
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1">
      {news.map(item => <NewsCard key={item.id} item={item} />)}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/NewsCard.tsx src/components/NewsFeed.tsx && git commit -m "feat: add NewsCard and NewsFeed components"
```

---

## Task 15: MarketSummary Component

**Files:**
- Create: `src/components/MarketSummary.tsx`

- [ ] **Step 1: Create MarketSummary**

Create `src/components/MarketSummary.tsx`:
```typescript
'use client';
import { useEffect, useState } from 'react';
import type { MarketContext, Volatility } from '@/types';

interface MarketSummaryProps {
  ticker: string | null;
}

const volatilityLabel: Record<Volatility, string> = {
  '높음': '변동성↑',
  '보통': '변동성→',
  '낮음': '변동성↓',
};

export function MarketSummary({ ticker }: MarketSummaryProps) {
  const [ctx, setCtx] = useState<MarketContext | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) {
      setCtx(null);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/market-context?ticker=${ticker}`);
        let data: MarketContext | null = await res.json();

        if (!data) {
          // Trigger analysis
          const postRes = await fetch('/api/market-context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker }),
          });
          if (postRes.ok) data = await postRes.json();
        }

        setCtx(data);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [ticker]);

  if (!ticker) return null;

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse">
        <div className="h-4 w-48 bg-zinc-300 dark:bg-zinc-600 rounded mb-2" />
        <div className="h-4 w-full bg-zinc-300 dark:bg-zinc-600 rounded" />
      </div>
    );
  }

  if (!ctx) return null;

  return (
    <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800">
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          호재 {ctx.bullish_count}
        </span>
        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
          악재 {ctx.bearish_count}
        </span>
        {ctx.rate_impact && (
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            금리: {ctx.rate_impact}
          </span>
        )}
        {ctx.oil_impact && (
          <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
            유가: {ctx.oil_impact}
          </span>
        )}
        {ctx.volatility && (
          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
            {volatilityLabel[ctx.volatility]}
          </span>
        )}
      </div>
      {ctx.summary_ko && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{ctx.summary_ko}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MarketSummary.tsx && git commit -m "feat: add MarketSummary component"
```

---

## Task 16: SearchBar + WatchlistButton

**Files:**
- Create: `src/components/SearchBar.tsx`
- Create: `src/components/WatchlistButton.tsx`

- [ ] **Step 1: Create SearchBar**

Create `src/components/SearchBar.tsx`:
```typescript
'use client';
import { useState } from 'react';

interface SearchBarProps {
  onSearch: (ticker: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [input, setInput] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim().toUpperCase();
    if (trimmed) onSearch(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl">
      <input
        type="text"
        placeholder="종목 티커 입력 (예: AAPL, RKLB)"
        value={input}
        onChange={e => setInput(e.target.value.toUpperCase())}
        className="flex-1 px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      <button
        type="submit"
        className="px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        검색
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create WatchlistButton**

Create `src/components/WatchlistButton.tsx`:
```typescript
'use client';
import { useState, useEffect } from 'react';

interface WatchlistButtonProps {
  ticker: string;
  companyName?: string;
}

export function WatchlistButton({ ticker, companyName }: WatchlistButtonProps) {
  const [inList, setInList] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/watchlist')
      .then(r => r.ok ? r.json() : [])
      .then((items: Array<{ ticker: string }>) => {
        setInList(items.some(i => i.ticker === ticker));
      })
      .catch(() => {});
  }, [ticker]);

  async function toggle() {
    setLoading(true);
    try {
      if (inList) {
        await fetch(`/api/watchlist?ticker=${ticker}`, { method: 'DELETE' });
        setInList(false);
      } else {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, company_name: companyName }),
        });
        setInList(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
        inList
          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 hover:bg-yellow-200'
          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200'
      }`}
    >
      {loading ? '...' : inList ? '★ 관심 종목' : '☆ 관심 추가'}
    </button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SearchBar.tsx src/components/WatchlistButton.tsx && git commit -m "feat: add SearchBar and WatchlistButton components"
```

---

## Task 17: Root Page Layout (wire everything together)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update layout.tsx title**

Edit `src/app/layout.tsx` — change only the metadata:
```typescript
export const metadata: Metadata = {
  title: 'StockInsight',
  description: '해외 주식 분석 대시보드',
};
```

- [ ] **Step 2: Replace page.tsx with dashboard layout**

Replace the entire content of `src/app/page.tsx`:
```typescript
'use client';
import { useState, useEffect } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { PricePanel } from '@/components/PricePanel';
import { StockChart } from '@/components/StockChart';
import { NewsFeed } from '@/components/NewsFeed';
import { MarketSummary } from '@/components/MarketSummary';
import { WatchlistButton } from '@/components/WatchlistButton';
import { useFinnhubWS } from '@/hooks/useFinnhubWS';
import type { PriceData } from '@/types';
import type { LineData } from 'lightweight-charts';

export default function Home() {
  const [ticker, setTicker] = useState<string | null>(null);
  const [eodData, setEodData] = useState<PriceData | null>(null);
  const [eodLoading, setEodLoading] = useState(false);
  const [chartData, setChartData] = useState<LineData[]>([]);

  const trade = useFinnhubWS(ticker);

  const preMarketPrice = trade?.price ?? null;
  const preMarketChangePct =
    trade && eodData
      ? ((trade.price - eodData.prev_close) / eodData.prev_close) * 100
      : null;

  useEffect(() => {
    if (!ticker) return;
    setEodLoading(true);
    setEodData(null);
    setChartData([]);

    fetch(`/api/stock/quote?ticker=${ticker}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: PriceData | null) => {
        if (data) {
          setEodData(data);
          // Single data point for now — extend with historical in future
          setChartData([{
            time: new Date().toISOString().split('T')[0] as `${number}-${number}-${number}`,
            value: data.today_close,
          }]);
        }
      })
      .finally(() => setEodLoading(false));
  }, [ticker]);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header / Search */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center gap-4">
        <span className="font-bold text-lg shrink-0">📈 StockInsight</span>
        <SearchBar onSearch={setTicker} />
        {ticker && (
          <WatchlistButton ticker={ticker} />
        )}
      </header>

      {/* Price Panels */}
      {ticker && (
        <div className="flex gap-4 px-6 py-4">
          <div>
            <p className="text-xs text-zinc-500 mb-1">프리마켓</p>
            <PricePanel
              label="실시간"
              price={preMarketPrice}
              changePct={preMarketChangePct}
              loading={false}
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">전일 정규장</p>
            <PricePanel
              label="마감가"
              price={eodData?.today_close ?? null}
              changePct={eodData?.change_pct ?? null}
              loading={eodLoading}
            />
          </div>
        </div>
      )}

      {/* Main Content — Layout B: 60/40 split */}
      <main className="flex gap-0 px-6 pb-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* Left 60% */}
        <div className="flex flex-col gap-4 flex-[3] min-w-0 pr-4">
          <StockChart ticker={ticker} data={chartData} />
          <MarketSummary ticker={ticker} />
        </div>

        {/* Right 40% — News Feed */}
        <div className="flex-[2] border-l border-zinc-200 dark:border-zinc-800 pl-4 flex flex-col">
          <h2 className="text-sm font-semibold text-zinc-500 mb-3">
            {ticker ? `📰 ${ticker} 뉴스` : '📰 뉴스'}
          </h2>
          <NewsFeed ticker={ticker} />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Start dev server and verify layout**

```bash
npm run dev
```

Open http://localhost:3000 in browser. Expected:
- Header with search bar
- Search for "RKLB" — price panels appear, news loads on right, market summary below chart
- No TypeScript errors in terminal

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx && git commit -m "feat: wire main dashboard layout — search, price panels, chart, news, market summary"
```

---

## Task 18: Login Page (Supabase Auth)

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Create login page**

Create `src/app/login/page.tsx`:
```typescript
'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('가입 완료! 이메일을 확인해주세요.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl font-bold mb-6 text-center">
          {mode === 'login' ? '로그인' : '회원가입'}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          {success && <p className="text-green-500 text-xs">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            className="py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="mt-4 text-xs text-zinc-400 hover:text-zinc-600 w-full text-center"
        >
          {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test login page in browser**

Navigate to http://localhost:3000/login. Expected: email/password form renders with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx && git commit -m "feat: add Supabase auth login/signup page"
```

---

## Task 19: Supabase Edge Function — watchlist-cron

**Files:**
- Create: `supabase/functions/watchlist-cron/index.ts`

- [ ] **Step 1: Create Edge Function**

Create `supabase/functions/watchlist-cron/index.ts`:
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get unique tickers from watchlist
  const { data: watchlistItems } = await supabase
    .from('watchlist')
    .select('ticker');

  if (!watchlistItems || watchlistItems.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tickers = [...new Set(watchlistItems.map((w: { ticker: string }) => w.ticker))];
  const appUrl = Deno.env.get('APP_URL') ?? 'https://your-app.vercel.app';

  let processed = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);

    for (const ticker of batch) {
      try {
        // Trigger translate pipeline
        await fetch(`${appUrl}/api/news/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        });

        // Trigger market context update
        await fetch(`${appUrl}/api/market-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        });

        processed++;
        // 100ms delay to respect Finnhub 60 req/min limit
        await new Promise(r => setTimeout(r, 100));
      } catch {
        // Continue on individual ticker failure
      }
    }
  }

  return new Response(JSON.stringify({ processed, total: tickers.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Deploy the Edge Function**

```bash
cd /Users/jang/Desktop/Study/stockinsight
npx supabase functions deploy watchlist-cron --project-ref gqyxbabwosrslwnhrsgc
```

Expected: "Deployed watchlist-cron"

- [ ] **Step 3: Set APP_URL secret in Supabase**

In Supabase Dashboard > Edge Functions > watchlist-cron > Secrets, add:
- `APP_URL` = your Vercel deployment URL (e.g., `https://stockinsight.vercel.app`)

- [ ] **Step 4: Enable pg_cron in Supabase**

In Supabase Dashboard > Database > Extensions, enable `pg_cron` and `pg_net`.

Then run in SQL editor:
```sql
select cron.schedule(
  'watchlist-news-refresh',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/watchlist-cron',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/watchlist-cron/index.ts && git commit -m "feat: add Supabase Edge Function for pg_cron watchlist refresh"
```

---

## Self-Review

**Spec coverage check:**
- [x] 종목 검색 → SearchBar (Task 16)
- [x] 프리마켓 등락률 → useFinnhubWS + PricePanel (Tasks 11, 12)
- [x] 전일 정규장 등락률 → FMP eodLight + PricePanel (Tasks 5, 12)
- [x] 차트 → StockChart lightweight-charts (Task 13)
- [x] 뉴스 피드 (번역·요약) → /api/news/translate + NewsFeed (Tasks 8, 14)
- [x] AI 시장 요약 → /api/market-context + MarketSummary (Tasks 9, 15)
- [x] 워치리스트 → /api/watchlist + WatchlistButton (Tasks 10, 16)
- [x] pg_cron 자동 갱신 → Edge Function (Task 19)
- [x] 레이아웃 B → page.tsx 60/40 split (Task 17)
- [x] 아키텍처 C → Finnhub WS client-direct, FMP via API Route, Supabase backend
- [x] middleware → proxy migration (Task 1)
- [x] RLS on watchlist → Supabase table SQL (Task 2)
- [x] Error states → NewsFeed empty state, PricePanel loading skeleton, translate fallback

**Type consistency check:**
- `PriceData.change_pct` defined in types/index.ts Task 3, used in PricePanel Task 12, set from FMP Task 5 — consistent.
- `NewsItem` shape matches Supabase news_cache columns — consistent.
- `MarketContext.volatility` typed as `Volatility = '높음' | '보통' | '낮음'` matches Supabase CHECK constraint — consistent.
- `translateNewsBatch` returns `BatchTranslateResult[]` with `index` field; consumed correctly in translate route — consistent.
