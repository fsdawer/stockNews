import { describe, it, expect, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
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
    };
  }),
}));

describe('translateNews', () => {
  it('returns Korean translation and sentiment', async () => {
    const { translateNews } = await import('./translate');
    const result = await translateNews('Rocket Lab wins $90M contract', 'Details here');
    expect(result.headline_ko).toBe('로켓랩 계약 수주 9000만 달러');
    expect(result.summary_ko).toBe('로켓랩이 신규 위성 발사 계약을 수주했다.');
    expect(result.sentiment).toBe('호재');
  });

  it('returns fallback on JSON parse failure', async () => {
    const AnthropicMock = (await import('@anthropic-ai/sdk')).default as any;
    AnthropicMock.mockImplementationOnce(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ text: 'not json' }],
          }),
        },
      };
    });
    const { translateNews } = await import('./translate');
    const result = await translateNews('headline', 'summary');
    expect(result.sentiment).toBe('중립');
    expect(result.headline_ko).toBe('headline');
  });
});

describe('translateNewsBatch', () => {
  it('returns batch translated results', async () => {
    const AnthropicMock = (await import('@anthropic-ai/sdk')).default as any;
    AnthropicMock.mockImplementationOnce(function() {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{
              text: JSON.stringify([
                { index: 1, headline_ko: '뉴스 제목 1', summary_ko: '요약 1', sentiment: '호재' },
                { index: 2, headline_ko: '뉴스 제목 2', summary_ko: '요약 2', sentiment: '악재' },
              ]),
            }],
          }),
        },
      };
    });

    const { translateNewsBatch } = await import('./translate');
    const results = await translateNewsBatch([
      { headline: 'News 1', summary: 'Summary 1' },
      { headline: 'News 2', summary: 'Summary 2' },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].headline_ko).toBe('뉴스 제목 1');
    expect(results[1].sentiment).toBe('악재');
  });
});
