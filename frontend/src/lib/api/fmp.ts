const BASE_URL = "https://financialmodelingprep.com/stable";
const API_KEY = process.env.FMP_API_KEY!;

async function fmpFetch<T>(path: string): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE_URL}${path}${separator}apikey=${API_KEY}`, {
    next: { revalidate: 3600 }, // 1시간 캐시
  });
  if (!res.ok) throw new Error(`FMP API error: ${res.status}`);
  return res.json();
}

export const fmp = {
  // 재무제표 (연간)
  incomeStatement: (ticker: string) =>
    fmpFetch(`/income-statement/${ticker}?limit=5`),

  balanceSheet: (ticker: string) =>
    fmpFetch(`/balance-sheet-statement/${ticker}?limit=5`),

  cashFlow: (ticker: string) =>
    fmpFetch(`/cash-flow-statement/${ticker}?limit=5`),

  // 주요 재무 비율
  ratios: (ticker: string) =>
    fmpFetch(`/ratios/${ticker}?limit=5`),

  // 기업 개요
  profile: (ticker: string) =>
    fmpFetch(`/profile/${ticker}`),

  // 주가 기록
  historicalPrice: (ticker: string, from: string, to: string) =>
    fmpFetch(`/historical-price-full/${ticker}?from=${from}&to=${to}`),

  // 실시간 주가
  quote: (ticker: string) =>
    fmpFetch(`/quote/${ticker}`),

  // 수익 추정 (애널리스트)
  analystEstimates: (ticker: string) =>
    fmpFetch(`/analyst-estimates/${ticker}?limit=4`),

  // 전일 종가 및 등락률
  eodLight: async (ticker: string): Promise<{
    today_close: number;
    prev_close: number;
    change_pct: number;
  }> => {
    const data = await fmpFetch<Array<{ date: string; price?: number; close?: number; volume: number }>>(
      `/historical-price-eod/light?symbol=${ticker}&limit=2`
    );
    if (!data || data.length < 2) {
      throw new Error(`Insufficient EOD data for ${ticker}`);
    }
    const today_close = data[0].price ?? data[0].close ?? 0;
    const prev_close = data[1].price ?? data[1].close ?? 0;
    const change_pct = ((today_close - prev_close) / prev_close) * 100;
    return { today_close, prev_close, change_pct };
  },
};
