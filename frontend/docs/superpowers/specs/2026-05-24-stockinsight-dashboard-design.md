# StockInsight Dashboard — 설계 문서

**작성일:** 2026-05-24  
**상태:** 승인됨

---

## 1. 개요

해외 주식 분석 대시보드. 검색창에 종목을 입력하면 프리마켓/전일 정규장 등락률, 실시간 차트, 번역된 뉴스 피드, AI 시장 요약을 보여준다.

---

## 2. 핵심 기능

| 기능 | 설명 |
|---|---|
| 종목 검색 | 티커/종목명으로 검색 |
| 프리마켓 등락률 | Finnhub WebSocket 실시간 수신 |
| 전일 정규장 등락률 | FMP stable API 1회 조회 (마감가 기준) |
| 차트 | 인터랙티브 가격 차트 |
| 뉴스 피드 | Finnhub REST → Claude Haiku 번역·요약 → Supabase 캐싱 |
| AI 시장 요약 | 호재/악재 건수, 금리·유가·변동성 영향 한 줄 요약 |
| 워치리스트 | 로그인 후 관심 종목 저장, pg_cron 자동 뉴스 갱신 |

---

## 3. 레이아웃 (B — 좌/우 분할형)

```
┌─────────────────────────────────────────────────────┐
│  🔍 검색창                                           │
├──────────────────────────────┬──────────────────────┤
│  [프리마켓 +2.34%]  [전일 -1.12%]                   │
├──────────────────────────────┤  📰 실시간 뉴스       │
│                              │  ─────────────────── │
│  📈 차트                     │  • 계약 수주 $90M     │
│                              │    (호재) 2시간 전    │
│                              │  • Q1 매출 +63%       │
├──────────────────────────────┤    (호재) 3시간 전    │
│  🤖 AI 시장 요약              │  • 주식 희석 우려     │
│  호재10 악재2 금리↓ 유가→ 변동성↑│    (악재) 4시간 전  │
└──────────────────────────────┴──────────────────────┘
```

---

## 4. 아키텍처 (접근법 C)

```
유저 브라우저
├── Finnhub WebSocket (클라이언트 직결) → 프리마켓 실시간
├── Next.js API Routes
│   ├── GET /api/stock/quote?ticker=   → FMP 전일 종가
│   ├── GET /api/news?ticker=          → Supabase 캐시 우선, 없으면 온디맨드
│   └── POST /api/news/translate       → Finnhub → Claude → Supabase 저장
└── Supabase Auth → 로그인/워치리스트

Supabase 백그라운드
├── pg_cron */5 * * * *  → Edge Function 호출
└── Edge Function         → 워치리스트 종목 뉴스 수집·번역·저장
```

---

## 5. DB 스키마

### watchlist
```sql
create table watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  ticker text not null,
  company_name text,
  added_at timestamptz default now(),
  unique(user_id, ticker)
);
alter table watchlist enable row level security;
create policy "본인 데이터만" on watchlist
  using (user_id = auth.uid());
```

### news_cache
```sql
create table news_cache (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  headline_en text not null,
  headline_ko text,
  summary_ko text,
  sentiment text check (sentiment in ('호재','악재','중립')),
  source_url text,
  published_at timestamptz,
  translated_at timestamptz,
  unique(ticker, source_url)
);
create index on news_cache (ticker, published_at desc);
```

### market_context
```sql
create table market_context (
  id uuid primary key default gen_random_uuid(),
  ticker text unique not null,
  sentiment_score text,
  bullish_count int default 0,
  bearish_count int default 0,
  rate_impact text,
  oil_impact text,
  volatility text,
  summary_ko text,
  updated_at timestamptz default now()
);
```

---

## 6. 에이전트 계층

```
👑 ceo-agent
├── 🖥️ frontend-agent
├── ⚙️ backend-agent
└── 📊 data-agent
    ├── stock-price-fetcher
    ├── news-pipeline-agent   ← AI 사용 (번역·분류)
    ├── market-context-agent  ← AI 사용 (매크로 요약)
    └── watchlist-cron-agent
```

**번역 AI:** 기본값 Claude Haiku (`claude-haiku-4-5`). 환경변수 `TRANSLATION_PROVIDER`로 교체 가능 (openai / deepl / claude).

---

## 7. 스킬 문서

| 파일 | 용도 |
|---|---|
| `docs/skills/finnhub-websocket.md` | WS 연결·구독·재연결 패턴 |
| `docs/skills/fmp-stable-endpoints.md` | FMP API 엔드포인트 레퍼런스 |
| `docs/skills/news-translation-pipeline.md` | 번역·분류 프롬프트 + 파이프라인 |
| `docs/skills/supabase-schema.md` | 테이블 구조 + RLS + cron 설정 |

---

## 8. 오류 처리

| 상황 | 처리 |
|---|---|
| WebSocket 끊김 | 5초 후 자동 재연결, 최대 3회 |
| Claude API 오류 | 원문 영어로 표시 (번역 실패 표기) |
| FMP API 한도 초과 | Supabase 마지막 캐시값 표시 |
| 뉴스 없음 | "최근 뉴스 없음" 빈 상태 UI |
