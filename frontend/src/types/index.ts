export type Sentiment = '호재' | '악재' | '중립';
export type Volatility = '높음' | '보통' | '낮음';

export interface NewsItem {
  id: string;
  ticker: string;
  headline_en: string;
  headline_ko: string | null;
  summary_ko: string | null;
  sentiment: Sentiment | null;
  source_url: string | null;
  published_at: string | null;
  translated_at: string | null;
}

export interface PriceData {
  price: number;
  prev_close: number;
  prev_change_pct: number; // (price - prev_close) / prev_close * 100
}

export interface MarketContext {
  ticker: string;
  sentiment_score: string | null;
  bullish_count: number;
  bearish_count: number;
  rate_impact: string | null;
  oil_impact: string | null;
  volatility: Volatility | null;
  summary_ko: string | null;
  updated_at: string;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  company_name: string | null;
  added_at: string;
}
