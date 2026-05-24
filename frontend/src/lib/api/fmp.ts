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
};
