import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SyncPricesPanel } from './SyncPricesPanel'

export const dynamic = 'force-dynamic'

export default async function AdminSyncPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/')

  // Coverage stats
  const tickerRows = await prisma.transaction.findMany({ distinct: ['ticker'], select: { ticker: true } })
  const tickers = [...new Set(tickerRows.map((r) => r.ticker.toUpperCase()))].sort()

  const historySummary = await prisma.$queryRaw<{ ticker: string; cnt: bigint; mindate: Date; maxdate: Date }[]>`
    SELECT ticker, COUNT(*) as cnt, MIN(date) as minDate, MAX(date) as maxDate
    FROM "HistoricalPrice"
    WHERE source = 'ASX'
    GROUP BY ticker
  `.catch(() => [] as { ticker: string; cnt: bigint; mindate: Date; maxdate: Date }[])

  const historyMap = new Map(historySummary.map((r) => [r.ticker, r]))
  const priceCacheCount = await prisma.priceCache.count()

  const coverage = tickers.map((t) => {
    const h = historyMap.get(t)
    return {
      ticker: t,
      points: h ? Number(h.cnt) : 0,
      from: h?.mindate ? new Date(h.mindate).toISOString().split('T')[0] : null,
      to: h?.maxdate ? new Date(h.maxdate).toISOString().split('T')[0] : null,
    }
  })

  const fundamentals = await prisma.marketIndexSnapshot.findMany({
    where: { ticker: { in: tickers } },
    select: {
      ticker: true, fetchedAt: true, companyName: true, sector: true,
      peRatio: true, eps: true, dividendYield: true, marketCap: true, extras: true,
    },
  })

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  const hasFmpKey = Boolean(settings?.fmpApiKey)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price Sync</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sync historical price data and fundamental stats for all portfolio tickers.
        </p>
      </div>

      <SyncPricesPanel tickers={tickers} coverage={coverage} priceCacheCount={priceCacheCount} fundamentals={fundamentals} hasFmpKey={hasFmpKey} />
    </div>
  )
}
