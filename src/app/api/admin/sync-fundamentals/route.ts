import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'
import { getFmpData } from '@/lib/fmp'

export async function POST() {
  const denied = await requireAdmin()
  if (denied) return denied

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  if (!settings?.fmpApiKey) {
    return NextResponse.json({ error: 'FMP API key not set — configure it in Admin → Settings' }, { status: 400 })
  }

  const tickerRows = await prisma.transaction.findMany({
    distinct: ['ticker'],
    select: { ticker: true },
  })
  const tickers = [...new Set(tickerRows.map((r) => r.ticker.toUpperCase()))].sort()

  let synced = 0
  let errors = 0
  const errorDetails: string[] = []

  // Rate-limit: process 5 at a time to avoid hammering FMP
  for (let i = 0; i < tickers.length; i += 5) {
    const batch = tickers.slice(i, i + 5)
    await Promise.allSettled(
      batch.map(async (ticker) => {
        try {
          const fmp = await getFmpData(ticker)

          const extras: Record<string, unknown> = {}
          if (fmp.ratios) {
            if (fmp.ratios.returnOnEquityTTM != null) extras.roe = fmp.ratios.returnOnEquityTTM
            if (fmp.ratios.returnOnAssetsTTM != null) extras.roa = fmp.ratios.returnOnAssetsTTM
            if (fmp.ratios.netProfitMarginTTM != null) extras.netMargin = fmp.ratios.netProfitMarginTTM
            if (fmp.ratios.debtEquityRatioTTM != null) extras.debtEquity = fmp.ratios.debtEquityRatioTTM
            if (fmp.ratios.currentRatioTTM != null) extras.currentRatio = fmp.ratios.currentRatioTTM
            if (fmp.ratios.pbRatioTTM != null) extras.pbRatio = fmp.ratios.pbRatioTTM
            if (fmp.ratios.priceToSalesRatioTTM != null) extras.psRatio = fmp.ratios.priceToSalesRatioTTM
            if (fmp.ratios.freeCashFlowPerShareTTM != null) extras.fcfPerShare = fmp.ratios.freeCashFlowPerShareTTM
          }
          if (fmp.income[0]) {
            if (fmp.income[0].revenue != null) extras.revenue = fmp.income[0].revenue
            if (fmp.income[0].netIncome != null) extras.netIncome = fmp.income[0].netIncome
            if (fmp.income[0].ebitda != null) extras.ebitda = fmp.income[0].ebitda
          }
          if (fmp.profile?.description) extras.description = fmp.profile.description
          if (fmp.profile?.fullTimeEmployees) extras.employees = fmp.profile.fullTimeEmployees
          if (fmp.profile?.website) extras.website = fmp.profile.website
          if (fmp.profile?.ipoDate) extras.ipoDate = fmp.profile.ipoDate
          if (fmp.profile?.image) extras.image = fmp.profile.image

          // Market cap from profile (FMP returns it as a number in profile)
          const rawProfile = fmp.profile as (typeof fmp.profile & { mktCap?: number }) | null
          const mktCap = rawProfile?.mktCap ?? null

          function fmtCap(v: number | null): string | null {
            if (v == null) return null
            if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
            if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
            if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
            return `$${v.toLocaleString()}`
          }

          await prisma.marketIndexSnapshot.upsert({
            where: { ticker },
            update: {
              fetchedAt: new Date(),
              companyName: fmp.profile?.companyName ?? undefined,
              sector: fmp.profile?.sector ?? undefined,
              industry: fmp.profile?.industry ?? undefined,
              peRatio: fmp.ratios?.peRatioTTM ?? undefined,
              eps: fmp.ratios?.epsBasicTTM ?? undefined,
              dividendYield: fmp.ratios?.dividendYielTTM ?? undefined,
              marketCap: fmtCap(mktCap),
              extras: Object.keys(extras).length > 0 ? JSON.stringify(extras) : undefined,
            },
            create: {
              ticker,
              fetchedAt: new Date(),
              companyName: fmp.profile?.companyName ?? null,
              sector: fmp.profile?.sector ?? null,
              industry: fmp.profile?.industry ?? null,
              peRatio: fmp.ratios?.peRatioTTM ?? null,
              eps: fmp.ratios?.epsBasicTTM ?? null,
              dividendYield: fmp.ratios?.dividendYielTTM ?? null,
              marketCap: fmtCap(mktCap),
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
