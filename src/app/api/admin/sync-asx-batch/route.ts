import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'
import { getYfAllData, checkTickerExists } from '@/lib/yahoo'
import { getFmpData } from '@/lib/fmp'

function safeFloat(v: number | null | undefined): number | null {
  if (v == null || !isFinite(v)) return null
  return v
}

function fmtCap(v: number | null): string | null {
  if (v == null) return null
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

// Syncs fundamentals for user-relevant tickers (portfolios, watchlists, price alerts).
// Missing snapshots are processed first, then oldest-fetched, up to `limit` per call.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') ?? '20', 10)))

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  const hasFmp = Boolean(settings?.fmpApiKey)

  // Gather all distinct user-relevant tickers (portfolios, watchlists, price alerts)
  const epoch = new Date(0)
  const [txRows, watchRows, alertRows] = await Promise.all([
    prisma.transaction.findMany({ select: { ticker: true }, distinct: ['ticker'] }),
    prisma.watchlistItem.findMany({ select: { ticker: true }, distinct: ['ticker'] }),
    prisma.priceAlert.findMany({ select: { ticker: true }, distinct: ['ticker'] }),
  ])
  const allUserTickers = [...new Set([
    ...txRows.map(r => r.ticker),
    ...watchRows.map(r => r.ticker),
    ...alertRows.map(r => r.ticker),
  ])]

  if (allUserTickers.length === 0) {
    return Response.json({ synced: 0, errors: 0, message: 'No portfolio tickers to sync' })
  }

  // Find which user tickers need syncing — missing snapshots first, then oldest fetchedAt
  const existingSnapshots = await prisma.marketIndexSnapshot.findMany({
    where: { ticker: { in: allUserTickers } },
    orderBy: { fetchedAt: 'asc' },
    select: { ticker: true, fetchedAt: true },
  })
  const existingTickerSet = new Set(existingSnapshots.map(r => r.ticker))
  const missingTickers = allUserTickers.filter(t => !existingTickerSet.has(t))

  const toSync = [
    ...missingTickers.map(ticker => ({ ticker, fetchedAt: epoch })),
    ...existingSnapshots,
  ].slice(0, limit)

  if (toSync.length === 0) {
    return Response.json({ synced: 0, errors: 0, message: 'All tickers are up to date' })
  }

  let synced = 0
  let errors = 0
  let deleted = 0
  const errorDetails: string[] = []

  // Process in batches of 5 to stay within Yahoo rate limits
  const BATCH = 5
  for (let i = 0; i < toSync.length; i += BATCH) {
    const batch = toSync.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(async ({ ticker }) => {
        try {
          const [yfAll, fmp] = await Promise.all([
            getYfAllData(ticker),
            hasFmp ? getFmpData(ticker) : Promise.resolve({ profile: null, ratios: null, news: [], income: [] }),
          ])

          // No data from either source — check if ticker actually exists
          if (!yfAll && !fmp.profile) {
            const exists = await checkTickerExists(ticker)
            if (!exists) {
              await prisma.marketIndexSnapshot.deleteMany({ where: { ticker } })
              await prisma.historicalPrice.deleteMany({ where: { ticker } })
              deleted++
              return
            }
          }

          const yfFund = yfAll?.fundamentals ?? null
          const yfProfile = yfAll?.profile ?? null

          const extras: Record<string, unknown> = {}
          if (fmp.ratios) {
            const sf = safeFloat
            const roe = sf(fmp.ratios.returnOnEquityTTM);       if (roe != null)  extras.roe = roe
            const roa = sf(fmp.ratios.returnOnAssetsTTM);       if (roa != null)  extras.roa = roa
            const nm  = sf(fmp.ratios.netProfitMarginTTM);      if (nm != null)   extras.netMargin = nm
            const de  = sf(fmp.ratios.debtEquityRatioTTM);      if (de != null)   extras.debtEquity = de
            const cr  = sf(fmp.ratios.currentRatioTTM);         if (cr != null)   extras.currentRatio = cr
            const pb  = sf(fmp.ratios.pbRatioTTM);              if (pb != null)   extras.pbRatio = pb
            const ps  = sf(fmp.ratios.priceToSalesRatioTTM);    if (ps != null)   extras.psRatio = ps
            const fcf = sf(fmp.ratios.freeCashFlowPerShareTTM); if (fcf != null)  extras.fcfPerShare = fcf
          }
          if (fmp.income[0]) {
            if (fmp.income[0].revenue != null)  extras.revenue = fmp.income[0].revenue
            if (fmp.income[0].netIncome != null) extras.netIncome = fmp.income[0].netIncome
            if (fmp.income[0].ebitda != null)   extras.ebitda = fmp.income[0].ebitda
          }
          if (fmp.profile?.description)       extras.description = fmp.profile.description
          if (fmp.profile?.fullTimeEmployees) extras.employees = fmp.profile.fullTimeEmployees
          if (fmp.profile?.website)           extras.website = fmp.profile.website
          if (yfProfile?.beta != null)        extras.beta = yfProfile.beta

          const rawProfile = fmp.profile as (typeof fmp.profile & { mktCap?: number }) | null
          const fmpMktCap = rawProfile?.mktCap ?? null

          const companyName = fmp.profile?.companyName ?? null
          const sector      = fmp.profile?.sector   || yfProfile?.sector   || null
          const industry    = fmp.profile?.industry || yfProfile?.industry || null
          const peRatio     = safeFloat(fmp.ratios?.peRatioTTM  ?? yfFund?.trailingPE)
          const eps         = safeFloat(fmp.ratios?.epsBasicTTM ?? yfFund?.trailingEps)
          const fmpDivYield = fmp.ratios?.dividendYielTTM != null ? fmp.ratios.dividendYielTTM * 100 : null
          const divYield    = safeFloat(fmpDivYield ?? yfFund?.dividendYield)
          const marketCap   = fmtCap(fmpMktCap ?? yfFund?.marketCap ?? null)

          const snapshotData = {
            fetchedAt:     new Date(),
            companyName:   companyName ?? null,
            sector:        sector      ?? null,
            industry:      industry    ?? null,
            peRatio:       peRatio     ?? null,
            eps:           eps         ?? null,
            dividendYield: divYield    ?? null,
            marketCap:     marketCap   ?? null,
            extras:        Object.keys(extras).length > 0 ? JSON.stringify(extras) : null,
          }
          await prisma.marketIndexSnapshot.upsert({
            where:  { ticker },
            // Use ?? undefined so existing non-null values are preserved when
            // the current fetch returns no data for a field (prevents wiping).
            update: {
              fetchedAt:     snapshotData.fetchedAt,
              companyName:   snapshotData.companyName   ?? undefined,
              sector:        snapshotData.sector        ?? undefined,
              industry:      snapshotData.industry      ?? undefined,
              peRatio:       snapshotData.peRatio       ?? undefined,
              eps:           snapshotData.eps           ?? undefined,
              dividendYield: snapshotData.dividendYield ?? undefined,
              marketCap:     snapshotData.marketCap     ?? undefined,
              extras:        snapshotData.extras        ?? undefined,
            },
            create: { ticker, ...snapshotData },
          })
          synced++
        } catch (err) {
          errors++
          errorDetails.push(`${ticker}: ${err instanceof Error ? err.message : 'failed'}`)
        }
      })
    )
  }

  // Count user tickers still not synced (no snapshot or still at epoch)
  const syncedCount = await prisma.marketIndexSnapshot.count({
    where: { ticker: { in: allUserTickers }, fetchedAt: { not: epoch } },
  })
  const stillNeverSynced = allUserTickers.length - syncedCount

  return Response.json({
    synced,
    errors,
    deleted,
    errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    batchSize: toSync.length,
    stillNeverSynced,
  })
}
