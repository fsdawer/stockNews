import { describe, it, expect, vi, beforeEach } from 'vitest';

global.fetch = vi.fn();

describe('fmp.eodLight', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns prev_close and change_pct when two data points exist', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { date: '2026-05-23', close: 131.39, volume: 12000000 },
        { date: '2026-05-22', close: 132.88, volume: 10000000 },
      ]),
    });

    const { fmp } = await import('./fmp');
    const result = await fmp.eodLight('RKLB');
    expect(result.prev_close).toBe(132.88);
    expect(result.today_close).toBe(131.39);
    expect(result.change_pct).toBeCloseTo(-1.12, 1);
  });

  it('throws on API error', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 429 });
    const { fmp } = await import('./fmp');
    await expect(fmp.eodLight('RKLB')).rejects.toThrow('FMP API error: 429');
  });

  it('throws when fewer than 2 data points returned', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ date: '2026-05-23', close: 131.39, volume: 12000000 }]),
    });
    const { fmp } = await import('./fmp');
    await expect(fmp.eodLight('RKLB')).rejects.toThrow();
  });
});
