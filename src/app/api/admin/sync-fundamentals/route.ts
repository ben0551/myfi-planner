import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'
import { getFmpData } from '@/lib/fmp'
import { getYfFundamentals, getYfProfile } from '@/lib/yahoo'

function fmtCap(v: number | null): string | null {
  if (v == null) return null
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

export async function POST() {
  const denied = await requireAdmin()
  if (denied) return denied

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  const hasFmp = Boolean(settings?.fmpApiKey)

  const tickerRows = await prisma.transaction.findMany({
    distinct: ['ticker'],
    select: { ticker: true },
  })
  const tickers = [...new Set(tickerRows.map((r) => r.ticker.toUpperCase()))].sort()

  let synced = 0
  let errors = 0
  const errorDetails: string[] = []

  for (let i = 0; i < tickers.length; i += 5) {
    const batch = tickers.slice(i, i + 5)
    await Promise.allSettled(
      batch.map(async (ticker) => {
        try {
          // Try FMP first, then fall back to Yahoo Finance for missing fields
          const [fmp, yfFund, yfProfile] = await Promise.all([
            hasFmp ? getFmpData(ticker) : Promise.resolve({ profile: null, ratios: null, news: [], income: [] }),
            getYfFundamentals(ticker),
            getYfProfile(ticker),
          ])

          const extras: Record<string, unknown> = {}

          // FMP ratios (best quality when available)
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
          if (fmp.profile?.ipoDate)           extras.ipoDate = fmp.profile.ipoDate
          if (fmp.profile?.image)             extras.image = fmp.profile.image

          const rawProfile = fmp.profile as (typeof fmp.profile & { mktCap?: number }) | null
          const fmpMktCap = rawProfile?.mktCap ?? null

          // Resolved values — FMP wins, Yahoo is fallback
          // Dividend yield: store as % (3.5 = 3.5%). Yahoo already returns %, FMP returns decimal → * 100
          const companyName = fmp.profile?.companyName ?? null
          const sector      = fmp.profile?.sector   || yfProfile?.sector   || null
          const industry    = fmp.profile?.industry || yfProfile?.industry || null
          const peRatio     = fmp.ratios?.peRatioTTM  ?? yfFund?.trailingPE  ?? null
          const eps         = fmp.ratios?.epsBasicTTM ?? yfFund?.trailingEps ?? null
          const fmpDivYield = fmp.ratios?.dividendYielTTM != null ? fmp.ratios.dividendYielTTM * 100 : null
          const divYield    = fmpDivYield ?? yfFund?.dividendYield ?? null
          const marketCap   = fmtCap(fmpMktCap ?? yfFund?.marketCap ?? null)

          if (yfProfile?.beta != null) extras.beta = yfProfile.beta

          await prisma.marketIndexSnapshot.upsert({
            where: { ticker },
            update: {
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
            create: {
              ticker,
              fetchedAt: new Date(),
              companyName, sector, industry, peRatio, eps,
              dividendYield: divYield,
              marketCap,
              extras: Object.keys(extras).length > 0 ? JSON.stringify(extras) : null,
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

  return NextResponse.json({ tickers: tickers.length, synced, errors, errorDetails })
}
