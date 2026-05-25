const BASE_URL = "https://finnhub.io/api/v1";
const API_KEY = process.env.FINNHUB_API_KEY!;

async function finnhubFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE_URL}${path}${separator}token=${API_KEY}`, {
    next: { revalidate: 1800 }, // 30분 캐시
    ...options,
  });
  if (!res.ok) throw new Error(`Finnhub API error: ${res.status}`);
  return res.json();
}

export const finnhub = {
  // 최근 뉴스 — 캐시 금지 (항상 최신 뉴스 필요)
  companyNews: (ticker: string, from: string, to: string) =>
    finnhubFetch(`/company-news?symbol=${ticker}&from=${from}&to=${to}`, { cache: 'no-store' }),

  // 기업 기본 정보
  companyProfile: (ticker: string) =>
    finnhubFetch(`/stock/profile2?symbol=${ticker}`),

  // 주요 재무 지표
  basicFinancials: (ticker: string) =>
    finnhubFetch(`/stock/metric?symbol=${ticker}&metric=all`),

  // 애널리스트 추천
  recommendation: (ticker: string) =>
    finnhubFetch(`/stock/recommendation?symbol=${ticker}`),

  // 실적 서프라이즈
  earningsSurprise: (ticker: string) =>
    finnhubFetch(`/stock/earnings?symbol=${ticker}&limit=4`),

  // 내부자 거래
  insiderTransactions: (ticker: string) =>
    finnhubFetch(`/stock/insider-transactions?symbol=${ticker}`),
};
