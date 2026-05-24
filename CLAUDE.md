# StockInsight — Claude Code Instructions

## 종목 분석 워크플로우

사용자가 종목 분석을 요청하면 **반드시 아래 순서**를 따른다.

### 1단계: 3개 에이전트 병렬 실행

단일 `Agent` 도구 호출 메시지에서 아래 세 에이전트를 **동시에(병렬로)** 실행한다.

| 에이전트 | subagent_type | 역할 |
|---|---|---|
| 재무 분석가 | `financial-analyst-kr` | 매출 추이, 수익성 지표, 밸류에이션, 재무 건전성 |
| 뉴스 감성 분석가 | `news-sentiment-analyst` | 최근 1개월 뉴스 호재/악재 분류, 시장 심리 판정 |
| 업종 리서처 | `sector-researcher` | 글로벌 업종 흐름, 경쟁사 현황, 규제 변화, 업종 전망 |

세 에이전트는 **독립적이므로 순차 실행 금지** — 반드시 병렬로 띄운다.

```
# 올바른 호출 패턴 (한 메시지에 3개 Agent 호출)
Agent(subagent_type="financial-analyst-kr",  prompt="[종목명] 재무 분석")
Agent(subagent_type="news-sentiment-analyst", prompt="[종목명] 뉴스 감성 분석")
Agent(subagent_type="sector-researcher",      prompt="[종목명] 업종 분석")
```

### 2단계: 공격적 투자 전략가 종합

세 에이전트의 결과가 **모두** 반환된 후, `aggressive-investment-strategist` 에이전트를 실행하여 종합 투자 리포트를 작성한다.

프롬프트에 세 보고서 전문을 포함해야 한다:

```
다음은 [종목명]에 대한 세 분석가의 보고서입니다.

[재무 분석가 보고서]
{financial_analyst_result}

[뉴스 감성 분석가 보고서]
{news_sentiment_result}

[업종 리서처 보고서]
{sector_researcher_result}

위 세 보고서를 종합하여 최종 투자 판단을 내려주세요.
```

### 트리거 조건

아래 요청이 들어오면 이 워크플로우를 실행한다:

- "[종목명/티커] 분석해줘"
- "[종목명] 투자해도 될까?"
- "[종목명] 종합 분석 / 풀 분석"
- 그 외 종목에 대한 종합적 판단이 필요한 모든 요청

단순히 재무만, 뉴스만, 또는 업종만 요청하는 경우에는 해당 단일 에이전트만 실행한다.

## 에이전트 목록

```
.claude/agents/
├── financial-analyst-kr.md          # 재무 분석가
├── news-sentiment-analyst.md        # 뉴스 감성 분석가
├── sector-researcher.md             # 업종 리서처
└── aggressive-investment-strategist.md  # 공격적 투자 전략가 (최종 종합)
```

모든 에이전트는 `memory: project` 로 설정되어 있으므로 프로젝트 메모리를 공유한다.

---

## API / 외부 서비스 변경 규칙

### 절대 금지
- 사용자 승인 없이 API 제공자를 임의로 교체하지 않는다.
- 예: Finnhub → Yahoo Finance, Anthropic → Gemini 등

### 변경이 필요한 상황 발생 시 의무 절차

1. **문제 원인을 먼저 설명**한다.
   - 예: "Finnhub 무료 티어가 `/stock/candle` 엔드포인트에 403을 반환합니다."

2. **선택지를 제시**하고 사용자가 고르게 한다.
   - 예:
     > **A. Yahoo Finance** — API 키 불필요, 완전 무료, 비공식 API (언제든 막힐 수 있음)
     > **B. Alpha Vantage** — 무료 키 발급 필요, 하루 25회 제한
     > **C. FMP 유료 플랜 업그레이드** — 안정적이지만 비용 발생
     >
     > 어떤 방법으로 하시겠어요?

3. **사용자가 선택한 후에만** 코드를 변경한다.

### 현재 사용 중인 API 목록

| 서비스 | 용도 | 플랜 |
|--------|------|------|
| Finnhub WebSocket | 실시간 가격 | 무료 |
| Finnhub REST `/quote` | 전일 종가 | 무료 |
| Polygon.io | 30일 차트 히스토리 | 무료 (5회/분) |
| FMP `/search-symbol` | 종목 검색 자동완성 | 무료 |
| Supabase | DB, Auth | 무료 |
| Gemini 1.5 Flash | 뉴스 번역/요약 | 무료 |
