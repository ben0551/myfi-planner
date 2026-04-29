import { getYfQuote, getYfHistory } from '../yahoo'

// ── Interfaces kept identical so cache.ts / route handlers need no changes ───

export interface AsxQuote {
  code: string
  last_price: number
  change_price: number
  change_in_percent: string
  volume: number
  bid_price: number
  offer_price: number
  open_price: number
  high_price: number
  low_price: number
  market_cap: number
  pe: number | null
  eps: number | null
  annual_dividend_yield: number
  market_state: string
  last_trade_date: string
  company_name: string
}

export interface AsxPricePoint {
  close_price: number
  open_price: number
  high_price: number
  low_price: number
  volume: number
  end_date: string
}

export interface AsxHistoryResponse {
  prices: AsxPricePoint[]
}

export interface AsxAnnouncementsResponse {
  data: never[]
}

export interface AsxCompany {
  code: string
  name_abbrev: string
  official_name: string
  ppe_ind: string
  industry_group_name: string
  market_cap: number
  listing_date: string
  delisted_date: string | null
  balance_sheet_date: string
  primary_share: { isin_code: string }
}

// ── Implementations via Yahoo Finance v8 chart ────────────────────────────────

export async function getAsxQuote(ticker: string): Promise<AsxQuote> {
  const q = await getYfQuote(ticker)
  if (!q) throw new Error(`No data for ${ticker}`)

  return {
    code: ticker,
    last_price: q.price,
    change_price: q.change,
    change_in_percent: `${q.changePct.toFixed(4)}%`,
    volume: q.volume,
    bid_price: q.price,
    offer_price: q.price,
    open_price: q.price,
    high_price: q.high,
    low_price: q.low,
    market_cap: 0,
    pe: null,
    eps: null,
    annual_dividend_yield: 0,
    market_state: 'REGULAR',
    last_trade_date: new Date().toISOString(),
    company_name: q.companyName,
  }
}

export async function getAsxHistory(
  ticker: string,
  count = 200,
  _interval: 'daily' | 'weekly' = 'daily'
): Promise<AsxHistoryResponse> {
  const history = await getYfHistory(ticker, count)
  return {
    prices: history.map((h) => ({
      close_price: h.close,
      open_price: h.open,
      high_price: h.high,
      low_price: h.low,
      volume: h.volume,
      end_date: h.date,
    })),
  }
}

export async function getAsxAnnouncements(): Promise<AsxAnnouncementsResponse> {
  return { data: [] }
}

export async function getAsxCompany(ticker: string): Promise<AsxCompany> {
  const q = await getYfQuote(ticker)
  return {
    code: ticker,
    name_abbrev: q?.companyName ?? ticker,
    official_name: q?.companyName ?? ticker,
    ppe_ind: '',
    industry_group_name: '',
    market_cap: 0,
    listing_date: '',
    delisted_date: null,
    balance_sheet_date: '',
    primary_share: { isin_code: '' },
  }
}
