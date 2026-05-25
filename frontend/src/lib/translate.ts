import Anthropic from '@anthropic-ai/sdk';
import type { Sentiment } from '@/types';

interface TranslateResult {
  headline_ko: string;
  summary_ko: string;
  sentiment: Sentiment;
}

const PROMPT_SINGLE = (headline: string, summary: string) =>
  `다음 영어 금융 뉴스를 분석하세요.\n헤드라인: "${headline}"\n본문: "${summary}"\n\nJSON으로만 반환:\n{"headline_ko":"한국어 헤드라인 30자 이내","summary_ko":"핵심 2-3문장 투자자 관점","sentiment":"호재 또는 악재 또는 중립"}`;

const PROMPT_BATCH = (items: { headline: string; summary: string }[]) => {
  const numbered = items
    .map((n, i) => `${i + 1}. 헤드라인: "${n.headline}"\n   본문: "${n.summary}"`)
    .join('\n\n');
  return `다음 금융 뉴스 ${items.length}건을 분석하세요.\n\n${numbered}\n\nJSON 배열로만 반환:\n[{"index":1,"headline_ko":"...","summary_ko":"...","sentiment":"호재|악재|중립"},...]`;
};

async function callGemini(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  // JSON 블록만 추출
  const match = text.match(/```json\n?([\s\S]*?)\n?```/) ?? text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  return match ? match[1] ?? match[0] : text;
}

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = response.content.find((b) => 'text' in b);
  const text = block && 'text' in block ? (block as { text: string }).text : undefined;
  if (!text) throw new Error('Empty Claude response');
  return text;
}

async function callAI(prompt: string, maxTokens: number): Promise<string> {
  const provider = process.env.TRANSLATION_PROVIDER ?? 'gemini';
  if (provider === 'gemini') return callGemini(prompt, maxTokens);
  return callClaude(prompt, maxTokens);
}

export async function translateNews(headline: string, summary: string): Promise<TranslateResult> {
  try {
    const text = await callAI(PROMPT_SINGLE(headline, summary), 400);
    return JSON.parse(text) as TranslateResult;
  } catch (err) {
    console.error('[translate] translateNews failed:', err);
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

export async function translateNewsBatch(items: BatchNewsInput[]): Promise<BatchTranslateResult[]> {
  try {
    const text = await callAI(PROMPT_BATCH(items), 1200);
    return JSON.parse(text) as BatchTranslateResult[];
  } catch (err) {
    console.error('[translate] translateNewsBatch failed:', err);
    return items.map((item, i) => ({
      index: i + 1,
      headline_ko: item.headline,
      summary_ko: item.summary,
      sentiment: '중립' as Sentiment,
    }));
  }
}
