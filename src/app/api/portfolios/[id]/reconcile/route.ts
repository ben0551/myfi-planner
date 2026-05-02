import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

interface AdjustmentInput {
  ticker: string
  actualQty: number
}

export async function POST(
  request: NextRequest,
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

  const { adjustments }: { adjustments: AdjustmentInput[] } = await request.json()
  if (!Array.isArray(adjustments) || adjustments.length === 0) {
    return Response.json({ error: 'adjustments array required' }, { status: 400 })
  }

  // Compute current system qty per ticker from transactions
  const transactions = await prisma.transaction.findMany({
    where: {
      portfolioId: id,
      type: { in: ['BUY', 'SELL', 'DRP'] },
    },
    orderBy: { date: 'asc' },
    select: { type: true, ticker: true, quantity: true },
  })

  const systemQty = new Map<string, number>()
  for (const tx of transactions) {
    const t = tx.ticker.toUpperCase()
    const qty = Number(tx.quantity)
    const current = systemQty.get(t) ?? 0
    if (tx.type === 'BUY' || tx.type === 'DRP') {
      systemQty.set(t, current + qty)
    } else {
      systemQty.set(t, Math.max(0, current - qty))
    }
  }

  // Fetch current prices for the tickers being adjusted
  const tickers = adjustments.map(a => a.ticker.toUpperCase())
  const priceRows = await prisma.priceCache.findMany({
    where: { ticker: { in: tickers } },
    select: { ticker: true, price: true },
  })
  const priceMap = new Map(priceRows.map(r => [r.ticker, Number(r.price)]))

  const today = new Date()
  const created: { ticker: string; diff: number; txId: string }[] = []

  for (const adj of adjustments) {
    const ticker = adj.ticker.toUpperCase()
    const actual = Math.round(adj.actualQty * 1e6) / 1e6
    const system = Math.round((systemQty.get(ticker) ?? 0) * 1e6) / 1e6
    const diff = Math.round((actual - system) * 1e6) / 1e6

    // Skip if the difference is negligible
    if (Math.abs(diff) < 0.0001) continue

    const price = priceMap.get(ticker) ?? 0
    const type = diff > 0 ? 'BUY' : 'SELL'
    const qty = Math.abs(diff)

    const tx = await prisma.transaction.create({
      data: {
        portfolioId: id,
        type,
        ticker,
        date: today,
        quantity: qty,
        price,
        fees: 0,
        amount: null,
        frankingPct: 0,
        frankingCredit: 0,
        notes: `Balance reconciliation (system: ${system.toFixed(4)}, actual: ${actual.toFixed(4)})`,
      },
    })

    created.push({ ticker, diff, txId: tx.id })
  }

  return Response.json({ created })
}
