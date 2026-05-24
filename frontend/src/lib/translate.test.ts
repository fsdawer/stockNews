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
