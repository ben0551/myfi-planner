import { PrismaClient } from '@prisma/client'
import { fetchMarketIndexDividendHistory } from '../src/lib/marketindex'

async function main() {
  const db = new PrismaClient()

  const divTxs = await db.transaction.findMany({
    where: { type: { in: ['DIVIDEND', 'DRP'] }, frankingPct: 0 },
    select: { id: true, ticker: true, date: true },
  })

  const tickers = [...new Set(divTxs.map((t) => t.ticker.toUpperCase()))]
  console.log('Fetching MarketIndex history for:', tickers.join(', '))

  const miMap = new Map<string, Awaited<ReturnType<typeof fetchMarketIndexDividendHistory>>>()
  for (const ticker of tickers) {
    process.stdout.write(`  ${ticker}... `)
    const history = await fetchMarketIndexDividendHistory(ticker)
    miMap.set(ticker, history)
    console.log(`${history.length} records`)
  }

  let updated = 0
  for (const tx of divTxs) {
    const history = miMap.get(tx.ticker.toUpperCase()) ?? []
    const ts = new Date(tx.date).getTime()
    let match = history.find((h) => Math.abs(h.exDate.getTime() - ts) <= 3 * 86400 * 1000)
    if (!match) match = history.find((h) => Math.abs(h.exDate.getTime() - ts) <= 30 * 86400 * 1000)
    if (match != null && match.frankingPct > 0) {
      await db.transaction.update({ where: { id: tx.id }, data: { frankingPct: match.frankingPct } })
      console.log(`  + ${tx.ticker} ${new Date(tx.date).toISOString().split('T')[0]} -> ${match.frankingPct}%`)
      updated++
    } else {
      console.log(`  - ${tx.ticker} ${new Date(tx.date).toISOString().split('T')[0]} (no match)`)
    }
  }

  console.log(`\nDone: ${updated}/${divTxs.length} updated`)
  await db.$disconnect()
}

main().catch(console.error)
