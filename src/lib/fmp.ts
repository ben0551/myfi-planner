import { prisma } from './prisma'

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'

// ASX stocks on FMP use the ".AX" suffix (Yahoo Finance convention)
function fmpSymbol(ticker: string): string {
  return `${ticker.toUpperCase()}.AX`
}

async function getApiKey(): Promise<string | null> {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  return settings?.fmpApiKey ?? null
}

async function fmpFetch<T>(path: string, apiKey: string): Promise<T | null> {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${FMP_BASE}${path}${sep}apikey=${apiKey}`
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } }) // cache 1h
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data) && data.length === 0) return null
    return data as T
  } catch {
    return null
  }
}

export interface FmpProfile {
  symbol: string
  companyName: string
  sector: string
  industry: string
  description: string
  ceo: string
  website: string
  ipoDate: string
  fullTimeEmployees: string
  image: string
  country: string
  currency: string
  exchange: string
}

export interface FmpRatiosTTM {
  peRatioTTM: number | null
  pbRatioTTM: number | null
  priceToSalesRatioTTM: number | null
  dividendYielTTM: number | null   // FMP typo — "Yiel" not "Yield"
  epsBasicTTM: number | null
  returnOnEquityTTM: number | null
  returnOnAssetsTTM: number | null
  debtEquityRatioTTM: number | null
  currentRatioTTM: number | null
  netProfitMarginTTM: number | null
  freeCashFlowPerShareTTM: number | null
}

export interface FmpNewsArticle {
  title: string
  url: string
  publishedDate: string
  site: string
  text: string
  image: string | null
}

export interface FmpIncomeStatement {
  date: string
  revenue: number | null
  netIncome: number | null
  eps: number | null
  ebitda: number | null
  grossProfitRatio: number | null
}

export interface FmpData {
  profile: FmpProfile | null
  ratios: FmpRatiosTTM | null
  news: FmpNewsArticle[]
  income: FmpIncomeStatement[]
}

export async function getFmpData(ticker: string): Promise<FmpData> {
  const apiKey = await getApiKey()
  if (!apiKey) return { profile: null, ratios: null, news: [], income: [] }

  const sym = fmpSymbol(ticker)

  const [profileArr, ratiosArr, newsArr, incomeArr] = await Promise.all([
    fmpFetch<FmpProfile[]>(`/profile/${sym}`, apiKey),
    fmpFetch<FmpRatiosTTM[]>(`/ratios-ttm/${sym}`, apiKey),
    fmpFetch<FmpNewsArticle[]>(`/stock_news?tickers=${sym}&limit=8`, apiKey),
    fmpFetch<FmpIncomeStatement[]>(`/income-statement/${sym}?limit=4`, apiKey),
  ])

  return {
    profile: Array.isArray(profileArr) ? (profileArr[0] ?? null) : null,
    ratios: Array.isArray(ratiosArr) ? (ratiosArr[0] ?? null) : null,
    news: Array.isArray(newsArr) ? newsArr : [],
    income: Array.isArray(incomeArr) ? incomeArr : [],
  }
}
