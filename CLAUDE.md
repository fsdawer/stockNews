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
