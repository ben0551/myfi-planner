import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'
import { getYfAllData } from '@/lib/yahoo'
import { getFmpData } from '@/lib/fmp'

function fmtCap(v: number | null): string | null {
  if (v == null) return null
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

// Syncs fundamentals for the next batch of un-synced/stale tickers from MarketIndexSnapshot.
// Tickers are ordered by fetchedAt ASC (epoch = never synced → always first).
export async function POST(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') ?? '20', 10)))

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  const hasFmp = Boolean(settings?.fmpApiKey)

  // Pick oldest-fetched tickers — those with epoch date come first
  const toSync = await prisma.marketIndexSnapshot.findMany({
    orderBy: { fetchedAt: 'asc' },
    take: limit,
    select: { ticker: true, fetchedAt: true },
  })

  if (toSync.length === 0) {
    return Response.json({ synced: 0, errors: 0, message: 'All tickers are up to date' })
  }

  // Get count of remaining un-synced tickers for progress reporting
  const epoch = new Date(0)
  const neverSynced = await prisma.marketIndexSnapshot.count({ where: { fetchedAt: epoch } })

  let synced = 0
  let errors = 0
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

          const yfFund = yfAll?.fundamentals ?? null
          const yfProfile = yfAll?.profile ?? null

          const extras: Record<string, unknown> = {}
          if (fmp.ratios) {
            if (fmp.ratios.returnOnEquityTTM != null)       extras.roe = fmp.ratios.returnOnEquityTTM
            if (fmp.ratios.returnOnAssetsTTM != null)       extras.roa = fmp.ratios.returnOnAssetsTTM
            if (fmp.ratios.netProfitMarginTTM != null)      extras.netMargin = fmp.ratios.netProfitMarginTTM
            if (fmp.ratios.debtEquityRatioTTM != null)      extras.debtEquity = fmp.ratios.debtEquityRatioTTM
            if (fmp.ratios.currentRatioTTM != null)         extras.currentRatio = fmp.ratios.currentRatioTTM
            if (fmp.ratios.pbRatioTTM != null)              extras.pbRatio = fmp.ratios.pbRatioTTM
            if (fmp.ratios.priceToSalesRatioTTM != null)    extras.psRatio = fmp.ratios.priceToSalesRatioTTM
            if (fmp.ratios.freeCashFlowPerShareTTM != null) extras.fcfPerShare = fmp.ratios.freeCashFlowPerShareTTM
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

          const companyName = fmp.profile?.companyName ?? yfProfile?.sector ?? null
          const sector      = fmp.profile?.sector   || yfProfile?.sector   || null
          const industry    = fmp.profile?.industry || yfProfile?.industry || null
          const peRatio     = fmp.ratios?.peRatioTTM  ?? yfFund?.trailingPE  ?? null
          const eps         = fmp.ratios?.epsBasicTTM ?? yfFund?.trailingEps ?? null
          const fmpDivYield = fmp.ratios?.dividendYielTTM != null ? fmp.ratios.dividendYielTTM * 100 : null
          const divYield    = fmpDivYield ?? yfFund?.dividendYield ?? null
          const marketCap   = fmtCap(fmpMktCap ?? yfFund?.marketCap ?? null)

          await prisma.marketIndexSnapshot.update({
            where: { ticker },
            data: {
              fetchedAt: new Date(),
              companyName: companyName ?? undefined,
              sector:      sector      ?? undefined,
              industry:    industry    ?? undefined,
              peRatio:     peRatio     ?? undefined,
              eps:         eps         ?? undefined,
              dividendYield: divYield  ?? undefined,
              marketCap:   marketCap   ?? undefined,
              extras: Object.keys(extras).length > 0 ? JSON.stringify(extras) : undefined,
            },
          })
          synced++
        } catch (err) {
          errors++
          errorDetails.push(`${ticker}: ${err instanceof Error ? err.message : 'failed'}`)
        }
      })
    )
  }

  const stillNeverSynced = Math.max(0, neverSynced - synced)

  return Response.json({
    synced,
    errors,
    errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    batchSize: toSync.length,
    stillNeverSynced,
  })
}
