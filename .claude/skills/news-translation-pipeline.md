# 뉴스 번역 파이프라인 — 참조 문서

## 번역 AI 설정
환경변수 `TRANSLATION_PROVIDER` (기본: `claude`)

| 값 | 모델 | 특징 |
|---|---|---|
| `claude` | claude-haiku-4-5 | 기본값, 저렴, 빠름 |
| `openai` | gpt-4o-mini | 대안, 유사 비용 |
| `deepl` | DeepL API | 번역 품질 최상, 분류 불가 |

## 번역 프롬프트 템플릿

### 단건 번역
```
다음 영어 금융 뉴스를 분석하세요.

헤드라인: "{headline_en}"
본문 요약: "{summary_en}"

JSON 형식으로 반환:
{
  "headline_ko": "한국어 헤드라인 (원문에 충실하게, 30자 이내)",
  "summary_ko": "핵심 내용 2-3문장 요약 (투자자 관점)",
  "sentiment": "호재 또는 악재 또는 중립"
}

sentiment 기준:
- 호재: 실적 개선, 계약 수주, 주가 상승 요인
- 악재: 실적 부진, 소송, 주가 하락 요인, 희석
- 중립: 단순 정보, 인사, 분석 보고서
```

### 배치 번역 (5건씩)
```
다음 금융 뉴스 {count}건을 분석하세요.

{뉴스 목록 - 번호 매겨서}

각 뉴스에 대해 JSON 배열로 반환:
[
  {
    "index": 1,
    "headline_ko": "...",
    "summary_ko": "...",
    "sentiment": "호재|악재|중립"
  },
  ...
]
```

## API 호출 코드 (Claude)
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function translateNews(headline: string, summary: string) {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `다음 영어 금융 뉴스를 분석하세요.\n헤드라인: "${headline}"\n\nJSON으로 반환: {"headline_ko": "...", "summary_ko": "...", "sentiment": "호재|악재|중립"}`
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

## 비용 추산
- Haiku: 입력 $0.25/1M 토큰, 출력 $1.25/1M 토큰
- 뉴스 1건 ≈ 입력 200토큰 + 출력 100토큰
- 10종목 × 10건/5분 × 하루 = 최대 약 $0.05/일

## 오류 처리
- JSON 파싱 실패: 원문 영어 표시, sentiment = "중립"
- API 타임아웃: 3초 후 재시도 1회, 실패 시 원문 저장
