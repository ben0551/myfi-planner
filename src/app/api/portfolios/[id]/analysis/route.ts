import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildHoldings } from '@/lib/calculations'
import { getCachedAsxQuotes, getCachedProfiles, getCachedEtfProfiles } from '@/lib/asx/cache'
import { getYfHistoryFull, getYfHistoryFromDate } from '@/lib/yahoo'

// ── Benchmark helpers ──────────────────────────────────────────────────────────

const BENCHMARKS: Record<string, string> = {
  ASX200: '^AXJO',
  ALORDS: '^AORD',
  SP500: '^GSPC',
}

async function getBenchmarkHistory(benchmarkKey: string, fromDate: Date): Promise<{ date: string; close: number }[]> {
  const symbol = BENCHMARKS[benchmarkKey] ?? BENCHMARKS.ASX200

  // Check DB first (HistoricalPrice with source='BENCHMARK')
  const latest = await prisma.historicalPrice.findFirst({
    where: { ticker: symbol, source: 'BENCHMARK' },
    orderBy: { date: 'desc' },
  })

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let newPoints: { date: Date; close: number }[] = []

  if (!latest) {
    const full = await getYfHistoryFull(symbol)
    newPoints = full.map((p) => ({ date: new Date(p.date), close: p.close }))
  } else {
    const latestDate = new Date(latest.date)
    if (latestDate < today) {
      const incremental = await getYfHistoryFromDate(symbol, latestDate)
      newPoints = incremental.map((p) => ({ date: new Date(p.date), close: p.close }))
    }
  }

  if (newPoints.length > 0) {
    await Promise.allSettled(
      newPoints.map((p) =>
        prisma.historicalPrice.upsert({
          where: { ticker_date_source: { ticker: symbol, date: p.date, source: 'BENCHMARK' } },
          update: { close: p.close },
          create: { ticker: symbol, date: p.date, close: p.close, source: 'BENCHMARK' },
        })
      )
    )
  }

  // Return history from the requested date
  const rows = await prisma.historicalPrice.findMany({
    where: { ticker: symbol, source: 'BENCHMARK', date: { gte: fromDate } },
    orderBy: { date: 'asc' },
    select: { date: true, close: true },
  })

  return rows.map((r) => ({ date: r.date.toISOString().split('T')[0], close: r.close }))
}

// ── Route ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const benchmark = request.nextUrl.searchParams.get('benchmark') ?? 'ASX200'

  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  const [transactions, snapshots] = await Promise.all([
    prisma.transaction.findMany({ where: { portfolioId: id }, orderBy: { date: 'asc' } }),
    prisma.portfolioSnapshot.findMany({
      where: { portfolioId: id },
      orderBy: { date: 'asc' },
      select: { date: true, value: true, invested: true },
    }),
  ])

  // Build current holdings + get prices
  const tickers = [...new Set(transactions.map((t) => t.ticker.toUpperCase()))]
  const [priceMap, profileMap, etfMap, manualClassifications] = await Promise.all([
    getCachedAsxQuotes(tickers),
    getCachedProfiles(tickers),
    getCachedEtfProfiles(tickers),
    prisma.tickerClassification.findMany({ where: { ticker: { in: tickers } } }),
  ])

  // Manual classifications take priority over auto-detected data
  const manualMap = new Map(manualClassifications.map((c) => [c.ticker, {
    instrumentType: c.instrumentType,
    riskCategory: c.riskCategory,
    industries: c.industries ? (JSON.parse(c.industries) as { name: string; pct: number }[]) : [],
    regions:    c.regions    ? (JSON.parse(c.regions)    as { name: string; pct: number }[]) : [],
    assetClasses: c.assetClasses ? (JSON.parse(c.assetClasses) as { name: string; pct: number }[]) : [],
  }]))

  // FMP fundamentals stored in MarketIndexSnapshot — use as primary sector/industry source
  const fmpSnapshots = await prisma.marketIndexSnapshot.findMany({
    where: { ticker: { in: tickers } },
    select: { ticker: true, sector: true, industry: true },
  })
  const fmpProfileMap = new Map(fmpSnapshots.map((s) => [s.ticker, s]))

  const holdings = buildHoldings(transactions, priceMap)
  const totalValue = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0)

  // Effective sector for a ticker: manual → FMP → Yahoo profile
  function getEffectiveSector(ticker: string): string | null {
    const manual = manualMap.get(ticker)
    if (manual?.industries.length) return null // handled via sectorWeights
    return fmpProfileMap.get(ticker)?.sector ?? profileMap.get(ticker)?.sector ?? null
  }

  function getEffectiveIndustry(ticker: string): string | null {
    return fmpProfileMap.get(ticker)?.industry ?? profileMap.get(ticker)?.industry ?? null
  }

  // Helper: get effective sector/region weights for a ticker
  // Manual classification wins → Yahoo ETF look-through → Yahoo stock profile
  function getSectorWeights(ticker: string): { sector: string; pct: number }[] | null {
    const manual = manualMap.get(ticker)
    if (manual?.industries.length) return manual.industries.map((r) => ({ sector: r.name, pct: r.pct }))
    const etf = etfMap.get(ticker)
    if (etf?.isEtf && etf.sectorWeights.length) return etf.sectorWeights
    return null
  }

  function getRegionWeights(ticker: string): { country: string; pct: number }[] | null {
    const manual = manualMap.get(ticker)
    if (manual?.regions.length) return manual.regions.map((r) => ({ country: r.name, pct: r.pct }))
    const etf = etfMap.get(ticker)
    if (etf?.isEtf && etf.countryWeights.length) return etf.countryWeights
    return null
  }

  function isEtfTicker(ticker: string): boolean {
    const manual = manualMap.get(ticker)
    if (manual?.instrumentType) return manual.instrumentType === 'ETF' || manual.instrumentType === 'FUND'
    return etfMap.get(ticker)?.isEtf ?? false
  }

  // ── Sector allocation (with ETF look-through) ──────────────────────────────
  const sectorMap = new Map<string, number>()
  for (const h of holdings) {
    const value = h.currentValue ?? 0
    if (value === 0) continue
    const etf = etfMap.get(h.ticker)

    const sectorWeights = getSectorWeights(h.ticker)
    if (sectorWeights) {
      for (const sw of sectorWeights) {
        const portion = value * (sw.pct / 100)
        sectorMap.set(sw.sector, (sectorMap.get(sw.sector) ?? 0) + portion)
      }
    } else {
      const sector = getEffectiveSector(h.ticker) ?? 'Unknown'
      sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + value)
    }
  }
  const sectors = [...sectorMap.entries()]
    .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)

  // ── Region allocation (with ETF look-through where available) ─────────────
  const regionMap = new Map<string, number>()
  for (const h of holdings) {
    const value = h.currentValue ?? 0
    if (value === 0) continue
    const etf = etfMap.get(h.ticker)

    const regionWeights = getRegionWeights(h.ticker)
    if (regionWeights) {
      for (const rw of regionWeights) {
        const portion = value * (rw.pct / 100)
        regionMap.set(rw.country, (regionMap.get(rw.country) ?? 0) + portion)
      }
    } else {
      const etf = etfMap.get(h.ticker)
      const country = profileMap.get(h.ticker)?.country
        ?? (isEtfTicker(h.ticker) ? (etf?.etfName ?? h.ticker) : 'Unknown')
      regionMap.set(country, (regionMap.get(country) ?? 0) + value)
    }
  }
  const regions = [...regionMap.entries()]
    .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)

  // ── Risk composition ───────────────────────────────────────────────────────
  const riskBuckets: Record<string, number> = {
    Defensive: 0,   // beta < 0.5
    Moderate: 0,    // 0.5 – 1.0
    Growth: 0,      // 1.0 – 1.5
    Aggressive: 0,  // > 1.5
    Unknown: 0,     // no beta data
  }
  for (const h of holdings) {
    const value = h.currentValue ?? 0
    if (value === 0) continue
    const beta = profileMap.get(h.ticker)?.beta
    if (beta == null) { riskBuckets.Unknown += value; continue }
    if (beta < 0.5) riskBuckets.Defensive += value
    else if (beta < 1.0) riskBuckets.Moderate += value
    else if (beta < 1.5) riskBuckets.Growth += value
    else riskBuckets.Aggressive += value
  }
  const risk = Object.entries(riskBuckets)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))

  // ── Holdings with profile data ─────────────────────────────────────────────
  const holdingsWithProfile = holdings.map((h) => {
    const profile = profileMap.get(h.ticker)
    const etf = etfMap.get(h.ticker)
    const manual = manualMap.get(h.ticker)
    const effectiveSectorWeights = getSectorWeights(h.ticker) ?? []
    const effectiveRegionWeights = getRegionWeights(h.ticker) ?? []
    return {
      ticker: h.ticker,
      currentValue: h.currentValue ?? 0,
      pct: totalValue > 0 ? ((h.currentValue ?? 0) / totalValue) * 100 : 0,
      isEtf: isEtfTicker(h.ticker),
      etfName: etf?.etfName ?? null,
      instrumentType: manual?.instrumentType ?? (etf?.isEtf ? 'ETF' : null),
      riskCategory: manual?.riskCategory ?? null,
      hasManualClassification: !!manualMap.has(h.ticker),
      // Effective look-through (manual wins over auto)
      sectorWeights: effectiveSectorWeights,
      regionWeights: effectiveRegionWeights,
      // Fallback stock-level data
      sector: getEffectiveSector(h.ticker),
      industry: getEffectiveIndustry(h.ticker),
      country: profile?.country ?? null,
      beta: profile?.beta ?? null,
    }
  }).sort((a, b) => b.currentValue - a.currentValue)

  // ── Benchmark comparison ───────────────────────────────────────────────────
  let benchmarkSeries: { date: string; portfolio: number; benchmark: number }[] = []

  if (snapshots.length >= 2) {
    const fromDate = new Date(snapshots[0].date)
    const benchmarkHistory = await getBenchmarkHistory(benchmark, fromDate)

    // Align by date
    const portfolioByDate = new Map(
      snapshots.map((s) => [s.date.toISOString().split('T')[0], s.value])
    )
    const benchmarkByDate = new Map(benchmarkHistory.map((b) => [b.date, b.close]))

    // Get all common dates (portfolio has data and benchmark has data)
    const allDates = [...portfolioByDate.keys()].filter((d) => benchmarkByDate.has(d)).sort()

    if (allDates.length >= 2) {
      const basePortfolio = portfolioByDate.get(allDates[0])!
      const baseBenchmark = benchmarkByDate.get(allDates[0])!

      benchmarkSeries = allDates.map((date) => ({
        date,
        portfolio: basePortfolio > 0 ? ((portfolioByDate.get(date)! / basePortfolio) - 1) * 100 : 0,
        benchmark: baseBenchmark > 0 ? ((benchmarkByDate.get(date)! / baseBenchmark) - 1) * 100 : 0,
      }))
    }
  }

  return Response.json({
    totalValue,
    sectors,
    regions,
    risk,
    holdingsWithProfile,
    benchmarkSeries,
    benchmarkLabel: Object.keys(BENCHMARKS).find((k) => k === benchmark) ?? 'ASX200',
    currency: portfolio.currency,
  })
}
