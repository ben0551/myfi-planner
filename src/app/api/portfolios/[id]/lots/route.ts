import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import Decimal from 'decimal.js'

export interface Lot {
  date: string
  qty: number
  costPerUnit: number
  totalCost: number
  currentPrice: number | null
  totalGain: number | null
  gainPct: number | null
  holdDays: number
  discountEligible: boolean
}

// FIFO lot calculation: returns remaining parcels per ticker after applying all sells
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'asc' },
  })

  const tickers = [...new Set(transactions.map((t) => t.ticker.toUpperCase()))]
  if (tickers.length === 0) return Response.json({})

  const prices = await prisma.priceCache.findMany({
    where: { ticker: { in: tickers } },
    select: { ticker: true, price: true },
  })
  const priceMap = new Map(prices.map((p) => [p.ticker, Number(p.price)]))

  const now = new Date()
  const result: Record<string, Lot[]> = {}

  for (const ticker of tickers) {
    const txs = transactions.filter((t) => t.ticker.toUpperCase() === ticker)

    const lots: { date: Date; costPerUnit: Decimal; remaining: Decimal }[] = []

    for (const tx of txs) {
      if (tx.type === 'BUY' || tx.type === 'DRP') {
        const qty = new Decimal(tx.quantity.toString())
        const price = new Decimal(tx.price.toString())
        const fees = new Decimal(tx.fees.toString())
        const totalCost = qty.times(price).plus(fees)
        const costPerUnit = qty.gt(0) ? totalCost.dividedBy(qty) : price
        lots.push({ date: new Date(tx.date), costPerUnit, remaining: qty })
      } else if (tx.type === 'SELL') {
        // Consume oldest lots first (FIFO)
        let toSell = new Decimal(tx.quantity.toString())
        for (const lot of lots) {
          if (toSell.lte(0)) break
          const consumed = Decimal.min(lot.remaining, toSell)
          lot.remaining = lot.remaining.minus(consumed)
          toSell = toSell.minus(consumed)
        }
      }
    }

    const currentPrice = priceMap.get(ticker) ?? null
    const remaining: Lot[] = lots
      .filter((l) => l.remaining.gt(0.00001))
      .map((l) => {
        const qty = l.remaining.toNumber()
        const costPerUnit = l.costPerUnit.toNumber()
        const totalCost = qty * costPerUnit
        const totalGain = currentPrice !== null ? qty * currentPrice - totalCost : null
        const gainPct = totalGain !== null && totalCost > 0 ? (totalGain / totalCost) * 100 : null
        const holdDays = Math.floor((now.getTime() - l.date.getTime()) / 86400000)
        return {
          date: l.date.toISOString().slice(0, 10),
          qty,
          costPerUnit,
          totalCost,
          currentPrice,
          totalGain,
          gainPct,
          holdDays,
          discountEligible: holdDays >= 365,
        }
      })

    if (remaining.length > 0) result[ticker] = remaining
  }

  return Response.json(result)
}
