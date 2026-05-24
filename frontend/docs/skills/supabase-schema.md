# Supabase DB 스키마 — 참조 문서

## 테이블 생성 SQL

### watchlist
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

create policy "유저 본인 데이터만 접근"
  on public.watchlist
  for all
  using (user_id = auth.uid());
```

### news_cache
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

### market_context
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

## pg_cron 설정
```sql
-- 1. Extensions 활성화 (Supabase 대시보드 > Database > Extensions)
-- pg_cron, pg_net 활성화 필요

-- 2. 5분마다 워치리스트 뉴스 갱신
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

-- 3. 매일 오전 9시 (KST) = UTC 00:00 전일 종가 저장
select cron.schedule(
  'daily-price-cache',
  '0 0 * * 1-5',
  $$
    select net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/daily-price-update',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
```

## 자주 쓰는 쿼리

### 워치리스트 조회
```typescript
const { data } = await supabase
  .from('watchlist')
  .select('ticker, company_name, added_at')
  .order('added_at', { ascending: false });
```

### 최신 뉴스 10건 조회
```typescript
const { data } = await supabase
  .from('news_cache')
  .select('*')
  .eq('ticker', ticker)
  .not('translated_at', 'is', null)
  .order('published_at', { ascending: false })
  .limit(10);
```

### market_context upsert
```typescript
await supabase
  .from('market_context')
  .upsert({ ticker, ...analysisResult, updated_at: new Date().toISOString() },
    { onConflict: 'ticker' });
```
