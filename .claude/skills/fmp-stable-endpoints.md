# FMP Stable API — 엔드포인트 레퍼런스

**Base URL:** `https://financialmodelingprep.com/stable`  
**인증:** `?apikey={FMP_API_KEY}` (쿼리스트링)

> ⚠️ v3 엔드포인트는 deprecated. 반드시 `/stable` 사용.

## 주요 엔드포인트

### 회사 프로필
```
GET /stable/profile?symbol=RKLB
```
응답: companyName, sector, industry, mktCap, price, beta

### 전일 종가 (EOD)
```
GET /stable/historical-price-eod/light?symbol=RKLB&limit=2
```
응답:
```json
[
  { "date": "2026-05-23", "close": 131.39, "volume": 12345678 },
  { "date": "2026-05-22", "close": 132.88, "volume": 10987654 }
]
```
등락률 계산: `(data[0].close - data[1].close) / data[1].close * 100`

### 실시간 주가
```
GET /stable/quote-short?symbol=RKLB
```
응답: `[{ "symbol": "RKLB", "price": 134.50, "volume": 9876543 }]`

### 재무 비율
```
GET /stable/ratios?symbol=RKLB&limit=1
```
응답: peRatio, pbRatio, debtToEquity, currentRatio, roe

### 손익계산서
```
GET /stable/income-statement?symbol=RKLB&limit=3
```
응답: revenue, operatingIncome, netIncome (연간 3년치)

## 한도
- 무료 플랜: 250 req/일
- 전략: EOD 가격은 하루 1번만 조회 후 Supabase 캐싱

## TypeScript 래퍼 위치
`/frontend/src/lib/api/fmp.ts`
