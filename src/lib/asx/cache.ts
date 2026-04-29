import { prisma } from '../prisma'
import { getYfQuote, getYfProfile, getYfEtfProfile, type EtfProfile } from '../yahoo'
import type { QuoteResult } from '../types'

const PRICE_TTL_MS = 60 * 60 * 1000 // 60 minutes

// ── In-memory ETF profile cache (24-hour TTL, resets on server restart) ───────
const _etfCache = new Map<string, { profile: EtfProfile; expiresAt: number }>()
const ETF_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Fetch ETF look-through profiles (sector weights) for a set of tickers.
 * Non-ETF tickers return {isEtf: false, ...}. Results are in-memory cached for 24h.
 */
export async function getCachedEtfProfiles(tickers: string[]): Promise<Map<string, EtfProfile>> {
  const result = new Map<string, EtfProfile>()
  if (tickers.length === 0) return result

  const upper = tickers.map((t) => t.toUpperCase())
  const now = Date.now()
  const missing: string[] = []

  for (const ticker of upper) {
    const cached = _etfCache.get(ticker)
    if (cached && cached.expiresAt > now) {
      result.set(ticker, cached.profile)
    } else {
      missing.push(ticker)
    }
  }

  // Fetch missing in parallel (rate-limit to 5 concurrent)
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5)
    await Promise.allSettled(
      batch.map(async (ticker) => {
        const profile = await getYfEtfProfile(ticker)
        const p: EtfProfile = profile ?? { isEtf: false, sectorWeights: [], countryWeights: [], etfName: null }
        _etfCache.set(ticker, { profile: p, expiresAt: now + ETF_TTL_MS })
        result.set(ticker, p)
      })
    )
  }

  // Fill any still-missing
  for (const t of upper) {
    if (!result.has(t)) result.set(t, { isEtf: false, sectorWeights: [], countryWeights: [], etfName: null })
  }

  return result
}

export async function getCachedAsxQuotes(
  tickers: string[]
): Promise<Map<string, QuoteResult>> {
  const result = new Map<string, QuoteResult>()
  if (tickers.length === 0) return result

  const upper = tickers.map((t) => t.toUpperCase())
  const now = new Date()
  const cutoff = new Date(now.getTime() - PRICE_TTL_MS)

  // Read fresh cache entries
  const cached = await prisma.priceCache.findMany({
    where: {
      ticker: { in: upper },
      fetchedAt: { gte: cutoff },
    },
  })

  // Tickers that are fresh AND have 52-week data — truly complete
  const completeTickers = new Set(
    cached.filter((c) => c.fiftyTwoWeekHigh != null).map((c) => c.ticker)
  )
  for (const c of cached) {
    result.set(c.ticker, {
      ticker: c.ticker,
      price: c.price.toNumber(),
      currency: c.currency,
      change: c.change?.toNumber() ?? null,
      changePct: c.changePct?.toNumber() ?? null,
      marketTime: c.marketTime,
      source: 'ASX',
      companyName: c.companyName ?? null,
      fiftyTwoWeekHigh: c.fiftyTwoWeekHigh?.toNumber() ?? null,
      fiftyTwoWeekLow: c.fiftyTwoWeekLow?.toNumber() ?? null,
    })
  }

  // Fetch missing tickers OR those with incomplete 52-week data
  const stale = upper.filter((t) => !completeTickers.has(t))
  await Promise.allSettled(
    stale.map(async (ticker) => {
      try {
        const quote = await getYfQuote(ticker)
        if (!quote) {
          console.warn(`[asx] no quote returned for ${ticker}`)
          return
        }

        // Set result immediately — don't let a DB write failure suppress the price
        result.set(ticker, {
          ticker,
          price: quote.price,
          currency: 'AUD',
          change: quote.change,
          changePct: quote.changePct,
          marketTime: now,
          source: 'ASX',
          companyName: quote.companyName ?? null,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? null,
        })

        // Cache write is best-effort; failures are logged but don't affect the response
        prisma.priceCache.upsert({
          where: { ticker },
          update: {
            price: quote.price,
            currency: 'AUD',
            change: quote.change,
            changePct: quote.changePct,
            marketTime: now,
            fetchedAt: now,
            source: 'ASX',
            companyName: quote.companyName ?? null,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? null,
          },
          create: {
            ticker,
            price: quote.price,
            currency: 'AUD',
            change: quote.change,
            changePct: quote.changePct,
            marketTime: now,
            fetchedAt: now,
            source: 'ASX',
            companyName: quote.companyName ?? null,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? null,
          },
        }).catch((err) => console.error(`[asx] PriceCache write failed for ${ticker}:`, err))
      } catch (err) {
        console.error(`[asx] getCachedAsxQuotes failed for ${ticker}:`, err)
      }
    })
  )

  // Stale-cache fallback: for any ticker still missing after the live fetch,
  // serve whatever is in the DB regardless of age rather than returning nothing.
  const stillMissing = upper.filter((t) => !result.has(t))
  if (stillMissing.length > 0) {
    const staleRows = await prisma.priceCache.findMany({
      where: { ticker: { in: stillMissing } },
    })
    for (const c of staleRows) {
      if (c.price.toNumber() > 0) {
        result.set(c.ticker, {
          ticker: c.ticker,
          price: c.price.toNumber(),
          currency: c.currency,
          change: c.change?.toNumber() ?? null,
          changePct: c.changePct?.toNumber() ?? null,
          marketTime: c.marketTime,
          source: 'ASX',
          companyName: c.companyName ?? null,
          fiftyTwoWeekHigh: c.fiftyTwoWeekHigh?.toNumber() ?? null,
          fiftyTwoWeekLow: c.fiftyTwoWeekLow?.toNumber() ?? null,
        })
        console.warn(`[asx] serving stale cache for ${c.ticker} (fetchedAt: ${c.fetchedAt.toISOString()})`)
      }
    }
  }

  return result
}

/**
 * Upsert extended metadata (company name, 52-week range) into PriceCache.
 * Called after a research/history fetch that has this data available.
 * Does NOT update price/change since those have their own TTL.
 */
export async function updatePriceCacheMeta(
  ticker: string,
  meta: {
    companyName?: string | null
    fiftyTwoWeekHigh?: number | null
    fiftyTwoWeekLow?: number | null
  }
): Promise<void> {
  try {
    await prisma.priceCache.upsert({
      where: { ticker },
      update: {
        companyName: meta.companyName ?? undefined,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? undefined,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? undefined,
      },
      create: {
        ticker,
        price: 0,
        currency: 'AUD',
        marketTime: new Date(),
        fetchedAt: new Date(0), // epoch → will be treated as stale for price fetches
        companyName: meta.companyName ?? null,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      },
    })
  } catch (err) {
    console.error(`[cache] updatePriceCacheMeta failed for ${ticker}:`, err)
  }
}

/** Profile TTL: 7 days — sector/country rarely changes */
const PROFILE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface TickerProfile {
  ticker: string
  sector: string | null
  industry: string | null
  country: string | null
  beta: number | null
}

/**
 * Return sector/country/industry/beta for a set of tickers.
 * Reads from PriceCache; fetches from Yahoo Finance for missing/stale entries.
 */
export async function getCachedProfiles(tickers: string[]): Promise<Map<string, TickerProfile>> {
  const result = new Map<string, TickerProfile>()
  if (tickers.length === 0) return result

  const upper = tickers.map((t) => t.toUpperCase())
  const cutoff = new Date(Date.now() - PROFILE_TTL_MS)

  const cached = await prisma.priceCache.findMany({
    where: { ticker: { in: upper } },
    select: { ticker: true, sector: true, industry: true, country: true, beta: true, fetchedAt: true },
  })

  const freshWithProfile = new Set(
    cached.filter((c) => c.sector != null && c.fetchedAt >= cutoff).map((c) => c.ticker)
  )

  for (const c of cached) {
    if (freshWithProfile.has(c.ticker)) {
      result.set(c.ticker, { ticker: c.ticker, sector: c.sector, industry: c.industry, country: c.country, beta: c.beta })
    }
  }

  const needsFetch = upper.filter((t) => !freshWithProfile.has(t))

  await Promise.allSettled(
    needsFetch.map(async (ticker) => {
      const profile = await getYfProfile(ticker)
      if (!profile) {
        result.set(ticker, { ticker, sector: null, industry: null, country: null, beta: null })
        return
      }
      try {
        await prisma.priceCache.upsert({
          where: { ticker },
          update: { sector: profile.sector, industry: profile.industry, country: profile.country, beta: profile.beta },
          create: {
            ticker,
            price: 0,
            currency: 'AUD',
            marketTime: new Date(),
            fetchedAt: new Date(0), // stale for price fetches
            sector: profile.sector,
            industry: profile.industry,
            country: profile.country,
            beta: profile.beta,
          },
        })
      } catch (err) {
        console.error(`[cache] profile upsert failed for ${ticker}:`, err)
      }
      result.set(ticker, { ticker, ...profile })
    })
  )

  // Fill any still-missing with nulls
  for (const t of upper) {
    if (!result.has(t)) result.set(t, { ticker: t, sector: null, industry: null, country: null, beta: null })
  }

  return result
}

export async function syncAnnouncements(ticker: string): Promise<void> {
  try {
    const url = `https://www.asx.com.au/asx/1/company/${ticker.toUpperCase()}/announcements?count=20&market_sensitive=false`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MyFiPlanner/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return

    const json = await res.json() as { data?: unknown[] }
    const items = json.data ?? []

    interface AsxItem {
      id: string
      header?: string
      document_release_date?: string
      url?: string
      market_sensitive?: boolean
      announcement_type_description?: string
    }

    await Promise.allSettled(
      (items as AsxItem[]).map(async (item) => {
        if (!item.id || !item.header) return
        const docUrl = item.url ?? `https://www.asx.com.au/asx/1/file/${item.id}/announcement`
        await prisma.announcement.upsert({
          where: { asxId: item.id },
          update: {
            title: item.header,
            url: docUrl,
            marketSensitive: item.market_sensitive ?? false,
            releasedAt: item.document_release_date ? new Date(item.document_release_date) : new Date(),
            category: item.announcement_type_description ?? null,
            fetchedAt: new Date(),
          },
          create: {
            asxId: item.id,
            ticker: ticker.toUpperCase(),
            title: item.header,
            url: docUrl,
            marketSensitive: item.market_sensitive ?? false,
            releasedAt: item.document_release_date ? new Date(item.document_release_date) : new Date(),
            category: item.announcement_type_description ?? null,
          },
        })
      })
    )
  } catch (err) {
    console.error(`[asx] syncAnnouncements failed for ${ticker}:`, err)
  }
}
