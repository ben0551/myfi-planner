import https from 'node:https'
import type { ResearchSummary } from './types'

// Yahoo Finance v8 chart — works without crumb/cookie dance
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

// ── Crumb auth (required for quoteSummary) ────────────────────────────────────
// Yahoo Finance locks quoteSummary behind a session crumb. We acquire it once
// by hitting the main page (to get a cookie), then /v1/test/getcrumb.
// The crumb is valid for the lifetime of the cookie (~1 hour).

let _crumbCache: { crumb: string; cookie: string; expiresAt: number } | null = null

/** Fetch Yahoo Finance homepage via node:https to avoid undici header-size limits */
function fetchYahooCookies(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      'https://finance.yahoo.com/',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html',
        },
        maxHeaderSize: 81920, // 80 KB — Yahoo sends a lot of Set-Cookie headers
      },
      (res) => {
        const raw = res.headers['set-cookie'] ?? []
        const cookie = raw.map((c) => c.split(';')[0].trim()).join('; ')
        res.resume() // drain body so socket is released
        resolve(cookie)
      }
    )
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  const now = Date.now()
  if (_crumbCache && _crumbCache.expiresAt > now) return _crumbCache

  try {
    // Step 1: get cookies using Node https (avoids undici header overflow)
    const cookie = await fetchYahooCookies()

    // Step 2: fetch the crumb
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: '*/*',
        Cookie: cookie,
      },
    })
    if (!crumbRes.ok) {
      console.warn('[yahoo] getcrumb HTTP', crumbRes.status)
      return null
    }
    const crumb = (await crumbRes.text()).trim()
    if (!crumb || crumb.includes('<')) return null // got HTML instead of crumb

    _crumbCache = { crumb, cookie, expiresAt: now + 50 * 60 * 1000 } // 50-min TTL
    return _crumbCache
  } catch (err) {
    console.error('[yahoo] getYahooCrumb failed:', err)
    return null
  }
}

function toSymbol(ticker: string) {
  return ticker.includes('.') ? ticker : `${ticker}.AX`
}

interface ChartMeta {
  symbol: string
  currency: string
  longName?: string
  shortName?: string
  regularMarketPrice?: number
  chartPreviousClose?: number
  regularMarketDayHigh?: number
  regularMarketDayLow?: number
  regularMarketVolume?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  regularMarketTime?: number
}

interface ChartResult {
  meta: ChartMeta
  timestamp: number[]
  indicators: {
    quote: Array<{
      open: number[]
      high: number[]
      low: number[]
      close: number[]
      volume: number[]
    }>
  }
}

async function doFetch(url: string): Promise<ChartResult | null> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.chart?.result?.[0] ?? null
}

/**
 * Returns false only when Yahoo definitively says the ticker doesn't exist
 * (HTTP 404 or a 200 with null result). Returns true on any ambiguous error
 * so we never delete a ticker due to a transient failure.
 */
export async function checkTickerExists(ticker: string): Promise<boolean> {
  const symbol = toSymbol(ticker)
  try {
    const res = await fetch(`${YF_BASE}/${symbol}?interval=1d&range=5d`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    })
    if (res.status === 404) return false
    if (!res.ok) return true // 5xx or rate-limit — assume exists, don't delete
    const data = await res.json()
    if (data?.chart?.result?.[0] == null) return false // 200 but no data
    return true
  } catch {
    return true // network error — be conservative
  }
}

/** Fetch chart using a named range (1d, 5d, 1mo, 3mo, 1y, 2y) */
export async function fetchChart(ticker: string, range = '1d'): Promise<ChartResult | null> {
  const symbol = toSymbol(ticker)
  return doFetch(`${YF_BASE}/${symbol}?interval=1d&range=${range}`)
}

/** Fetch chart using an explicit start date (for incremental history updates) */
export async function fetchChartFromDate(ticker: string, fromDate: Date): Promise<ChartResult | null> {
  const symbol = toSymbol(ticker)
  const period1 = Math.floor(fromDate.getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  return doFetch(`${YF_BASE}/${symbol}?interval=1d&period1=${period1}&period2=${period2}`)
}

export async function getResearchData(ticker: string): Promise<Partial<ResearchSummary>> {
  try {
    const chart = await fetchChart(ticker, '1y')
    if (!chart) return { ticker, companyName: ticker, analystCounts: { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 } }

    const meta = chart.meta
    const price = meta.regularMarketPrice ?? null
    const prevClose = meta.chartPreviousClose ?? null
    const change = price != null && prevClose != null ? price - prevClose : null
    const changePct = change != null && prevClose ? (change / prevClose) * 100 : null

    return {
      ticker,
      companyName: meta.longName ?? meta.shortName ?? ticker,
      currentPrice: price,
      change,
      changePct,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      marketCap: null,
      peRatio: null,
      forwardPE: null,
      eps: null,
      dividendYield: null,
      beta: null,
      recommendationMean: null,
      recommendationKey: null,
      analystCounts: { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 },
    }
  } catch (err) {
    console.error('[yahoo] getResearchData failed:', err)
    return { ticker, companyName: ticker, analystCounts: { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 } }
  }
}

export interface YfQuote {
  ticker: string
  price: number
  change: number
  changePct: number
  high: number
  low: number
  volume: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  companyName: string
}

export async function getYfQuote(ticker: string): Promise<YfQuote | null> {
  try {
    const chart = await fetchChart(ticker, '5d')
    if (!chart) return null
    const meta = chart.meta
    const price = meta.regularMarketPrice ?? 0
    const prevClose = meta.chartPreviousClose ?? price
    const change = price - prevClose
    const changePct = prevClose ? (change / prevClose) * 100 : 0
    return {
      ticker,
      price,
      change,
      changePct,
      high: meta.regularMarketDayHigh ?? price,
      low: meta.regularMarketDayLow ?? price,
      volume: meta.regularMarketVolume ?? 0,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? price,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? price,
      companyName: meta.longName ?? meta.shortName ?? ticker,
    }
  } catch {
    return null
  }
}

export interface YfHistoryPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

function parseChartToHistory(chart: ChartResult, count?: number): YfHistoryPoint[] {
  const timestamps = chart.timestamp ?? []
  const quote = chart.indicators?.quote?.[0]
  if (!quote) return []

  const points = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      open: quote.open[i] ?? 0,
      high: quote.high[i] ?? 0,
      low: quote.low[i] ?? 0,
      close: quote.close[i] ?? 0,
      volume: quote.volume[i] ?? 0,
    }))
    .filter((p) => p.close != null && p.close > 0)

  return count != null ? points.slice(-count) : points
}

export async function getYfHistory(ticker: string, count = 200): Promise<YfHistoryPoint[]> {
  try {
    const range = count <= 30 ? '1mo' : count <= 90 ? '3mo' : count <= 365 ? '1y' : '2y'
    const chart = await fetchChart(ticker, range)
    if (!chart) return []
    return parseChartToHistory(chart, count)
  } catch {
    return []
  }
}

/** Fetch only price history from a given date onwards (for incremental DB updates) */
export async function getYfHistoryFromDate(ticker: string, fromDate: Date): Promise<YfHistoryPoint[]> {
  try {
    const chart = await fetchChartFromDate(ticker, fromDate)
    if (!chart) return []
    return parseChartToHistory(chart) // no count limit — store everything returned
  } catch {
    return []
  }
}

/** Full 5-year history fetch — used for initial population and backfill */
export async function getYfHistoryFull(ticker: string): Promise<YfHistoryPoint[]> {
  try {
    const chart = await fetchChart(ticker, '5y')
    if (!chart) return []
    return parseChartToHistory(chart)
  } catch {
    return []
  }
}

// ── ETF look-through ──────────────────────────────────────────────────────────

/** Yahoo Finance sector key → display name */
const YF_SECTOR_MAP: Record<string, string> = {
  realestate:              'Real Estate',
  consumer_cyclical:       'Consumer Cyclical',
  financial_services:      'Financial Services',
  technology:              'Technology',
  healthcare:              'Healthcare',
  energy:                  'Energy',
  utilities:               'Utilities',
  basic_materials:         'Basic Materials',
  communication_services:  'Communication Services',
  consumer_defensive:      'Consumer Defensive',
  industrials:             'Industrials',
}

export interface EtfSectorWeight {
  sector: string
  pct: number   // 0–100
}

export interface EtfCountryWeight {
  country: string
  pct: number   // 0–100
}

export interface EtfProfile {
  isEtf: boolean
  sectorWeights: EtfSectorWeight[]
  countryWeights: EtfCountryWeight[]
  etfName: string | null
}

/**
 * Fetch ETF sector (and where available, country) weights via Yahoo Finance topHoldings.
 * Returns null only on network/auth failure. Returns isEtf=false for regular stocks.
 */
export async function getYfEtfProfile(ticker: string): Promise<EtfProfile | null> {
  try {
    const auth = await getYahooCrumb()
    if (!auth) return null

    const symbol = toSymbol(ticker)
    const modules = 'topHoldings,price'
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Cookie: auth.cookie,
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) { _crumbCache = null; return null }

    const data = await res.json()
    const result = data?.quoteSummary?.result?.[0]
    if (!result) return null

    const price = result.price ?? {}
    const isEtf = price.quoteType === 'ETF' || price.quoteType === 'MUTUALFUND'
    const etfName: string | null = price.longName ?? price.shortName ?? null

    if (!isEtf) {
      return { isEtf: false, sectorWeights: [], countryWeights: [], etfName: null }
    }

    // sectorWeightings: [{realestate: 0.078}, {financial_services: 0.29}, ...]
    const rawSectors: Record<string, number>[] = result.topHoldings?.sectorWeightings ?? []
    const sectorWeights: EtfSectorWeight[] = rawSectors
      .flatMap((obj) =>
        Object.entries(obj).map(([key, pct]) => ({
          sector: YF_SECTOR_MAP[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          pct: typeof pct === 'number' ? pct * 100 : 0,
        }))
      )
      .filter((s) => s.pct > 0.01)

    // Country exposure: Yahoo doesn't always provide this.
    // We use a heuristic: if the ETF name/description suggests domestic AU focus, mark as Australia.
    // For ETFs with no country data, we leave it empty and the caller can decide.
    const countryWeights: EtfCountryWeight[] = []
    const cashPosition = result.topHoldings?.cashPosition?.raw
    const pctInvested = cashPosition != null ? 1 - cashPosition : 1

    return { isEtf: true, sectorWeights, countryWeights, etfName }
  } catch (err) {
    console.error('[yahoo] getYfEtfProfile failed:', err)
    return null
  }
}

export interface YfFundamentals {
  marketCap: number | null
  trailingPE: number | null
  forwardPE: number | null
  trailingEps: number | null
  dividendYield: number | null
  beta: number | null
}

/**
 * Fetch key statistics via Yahoo Finance v10 quoteSummary.
 * Acquires a session crumb first so the endpoint accepts the request.
 */
export interface YfProfile {
  sector: string | null
  industry: string | null
  country: string | null
  beta: number | null
}

/** Fetch sector, industry, country, and beta — used for portfolio analysis. */
export async function getYfProfile(ticker: string): Promise<YfProfile | null> {
  try {
    const auth = await getYahooCrumb()
    if (!auth) return null

    const symbol = toSymbol(ticker)
    const modules = 'assetProfile,summaryDetail'
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Cookie: auth.cookie,
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) _crumbCache = null
      console.warn(`[yahoo] getYfProfile ${ticker} HTTP ${res.status}`)
      return null
    }
    const data = await res.json()
    const result = data?.quoteSummary?.result?.[0]
    if (!result) return null

    const ap = result.assetProfile ?? {}
    const sd = result.summaryDetail ?? {}

    return {
      sector: ap.sector ?? null,
      industry: ap.industry ?? null,
      country: ap.country ?? null,
      beta: sd.beta?.raw ?? ap.beta?.raw ?? null,
    }
  } catch (err) {
    console.error('[yahoo] getYfProfile failed:', err)
    return null
  }
}

export interface YfAllData {
  profile: YfProfile
  fundamentals: YfFundamentals
}

/**
 * Fetch profile + fundamentals in a single quoteSummary request.
 * Use this in the admin sync instead of separate getYfProfile + getYfFundamentals
 * calls to halve the number of Yahoo Finance requests and avoid rate limiting.
 */
export async function getYfAllData(ticker: string): Promise<YfAllData | null> {
  try {
    const auth = await getYahooCrumb()
    if (!auth) return null

    const symbol = toSymbol(ticker)
    const modules = 'assetProfile,summaryDetail,defaultKeyStatistics,price'
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Cookie: auth.cookie,
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) _crumbCache = null
      console.warn(`[yahoo] getYfAllData ${ticker} HTTP ${res.status}`)
      return null
    }
    const data = await res.json()
    const result = data?.quoteSummary?.result?.[0]
    if (!result) return null

    const ap = result.assetProfile ?? {}
    const sd = result.summaryDetail ?? {}
    const ks = result.defaultKeyStatistics ?? {}
    const price = result.price ?? {}

    return {
      profile: {
        sector:   ap.sector   ?? null,
        industry: ap.industry ?? null,
        country:  ap.country  ?? null,
        beta:     sd.beta?.raw ?? ap.beta?.raw ?? null,
      },
      fundamentals: {
        marketCap:     price.marketCap?.raw ?? sd.marketCap?.raw ?? null,
        trailingPE:    sd.trailingPE?.raw ?? null,
        forwardPE:     sd.forwardPE?.raw  ?? null,
        trailingEps:   ks.trailingEps?.raw ?? null,
        dividendYield: sd.dividendYield?.raw != null ? sd.dividendYield.raw * 100 : null,
        beta:          sd.beta?.raw ?? null,
      },
    }
  } catch (err) {
    console.error('[yahoo] getYfAllData failed:', err)
    return null
  }
}

export async function getYfFundamentals(ticker: string): Promise<YfFundamentals | null> {
  try {
    const auth = await getYahooCrumb()
    if (!auth) return null

    const symbol = toSymbol(ticker)
    const modules = 'summaryDetail,defaultKeyStatistics,price'
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Cookie: auth.cookie,
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) _crumbCache = null
      console.warn(`[yahoo] fundamentals ${ticker} HTTP ${res.status}`)
      return null
    }
    const data = await res.json()
    const result = data?.quoteSummary?.result?.[0]
    if (!result) return null

    const sd = result.summaryDetail ?? {}
    const ks = result.defaultKeyStatistics ?? {}
    const price = result.price ?? {}

    return {
      marketCap: price.marketCap?.raw ?? sd.marketCap?.raw ?? null,
      trailingPE: sd.trailingPE?.raw ?? null,
      forwardPE: sd.forwardPE?.raw ?? null,
      trailingEps: ks.trailingEps?.raw ?? null,
      // Yahoo returns dividendYield as a decimal (0.035 = 3.5%) — multiply by 100
      dividendYield: sd.dividendYield?.raw != null ? sd.dividendYield.raw * 100 : null,
      beta: sd.beta?.raw ?? null,
    }
  } catch (err) {
    console.error('[yahoo] getYfFundamentals failed:', err)
    return null
  }
}
