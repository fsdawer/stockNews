import Anthropic from '@anthropic-ai/sdk';
import type { Sentiment } from '@/types';

interface TranslateResult {
  headline_ko: string;
  summary_ko: string;
  sentiment: Sentiment;
}

export async function translateNews(
  headline: string,
  summary: string
): Promise<TranslateResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `다음 영어 금융 뉴스를 분석하세요.\n헤드라인: "${headline}"\n본문: "${summary}"\n\nJSON으로만 반환:\n{"headline_ko":"한국어 헤드라인 30자 이내","summary_ko":"핵심 2-3문장 투자자 관점","sentiment":"호재 또는 악재 또는 중립"}`,
      }],
    });

    const block = response.content.find((b) => 'text' in b);
    const text = block && 'text' in block ? (block as { text: string }).text : undefined;
    if (!text) throw new Error('Empty response from Claude');
    return JSON.parse(text) as TranslateResult;
  } catch (err) {
    console.error('[translate] translateNews failed, using fallback:', err);
    return { headline_ko: headline, summary_ko: summary, sentiment: '중립' };
  }
}

interface BatchNewsInput {
  headline: string;
  summary: string;
}

interface BatchTranslateResult extends TranslateResult {
  index: number;
}

export async function translateNewsBatch(
  items: BatchNewsInput[]
): Promise<BatchTranslateResult[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

    const block = response.content.find((b) => 'text' in b);
    const text = block && 'text' in block ? (block as { text: string }).text : undefined;
    if (!text) throw new Error('Empty response from Claude');
    const results = JSON.parse(text) as BatchTranslateResult[];
    return results;
  } catch (err) {
    console.error('[translate] translateNewsBatch failed, using fallback:', err);
    return items.map((item, i) => ({
      index: i + 1,
      headline_ko: item.headline,
      summary_ko: item.summary,
      sentiment: '중립' as Sentiment,
    }));
  }
}
