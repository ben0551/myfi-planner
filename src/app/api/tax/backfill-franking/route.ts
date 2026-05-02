import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { fetchMarketIndexDividendHistory } from '@/lib/marketindex'

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all confirmed DIVIDEND transactions for this user with frankingPct = 0
  const divTxs = await prisma.transaction.findMany({
    where: {
      portfolio: { userId: session.user.id },
      type: { in: ['DIVIDEND', 'DRP'] },
      frankingPct: 0,
    },
    select: { id: true, ticker: true, date: true },
  })

  if (divTxs.length === 0) return Response.json({ updated: 0 })

  // Build per-ticker lookup of MarketIndex dividend history
  const tickers = [...new Set(divTxs.map((t) => t.ticker.toUpperCase()))]
  const miHistoryMap = new Map<string, Awaited<ReturnType<typeof fetchMarketIndexDividendHistory>>>()
  await Promise.all(
    tickers.map(async (ticker) => {
      const history = await fetchMarketIndexDividendHistory(ticker)
      miHistoryMap.set(ticker, history)
    })
  )

  function findFranking(ticker: string, txDate: Date): number | null {
    const history = miHistoryMap.get(ticker.toUpperCase()) ?? []
    const ts = txDate.getTime()
    // Exact match first
    for (const h of history) {
      if (Math.abs(h.exDate.getTime() - ts) <= 3 * 86400 * 1000) return h.frankingPct
    }
    // Wider match within 30 days (pay date vs ex-date offset)
    for (const h of history) {
      if (Math.abs(h.exDate.getTime() - ts) <= 30 * 86400 * 1000) return h.frankingPct
    }
    return null
  }

  let updated = 0
  for (const tx of divTxs) {
    const pct = findFranking(tx.ticker, tx.date)
    if (pct != null && pct > 0) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { frankingPct: pct },
      })
      updated++
    }
  }

  return Response.json({ updated, total: divTxs.length })
}
