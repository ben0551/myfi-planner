import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
    select: {
      id: true, portfolioType: true,
      tdPrincipal: true, tdRate: true, tdStartDate: true, tdMaturityDate: true,
    },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  // TERM_DEPOSIT: compute value history from TD parameters so the chart starts
  // at tdStartDate regardless of whether the portfolio page has been visited.
  if (portfolio.portfolioType === 'TERM_DEPOSIT') {
    if (portfolio.tdPrincipal && portfolio.tdRate && portfolio.tdStartDate && portfolio.tdMaturityDate) {
      const principal    = portfolio.tdPrincipal
      const rate         = portfolio.tdRate / 100
      const startDate    = portfolio.tdStartDate
      const maturityDate = portfolio.tdMaturityDate
      const today        = new Date()
      const endDate      = today < maturityDate ? today : maturityDate

      function tdValueAt(d: Date): number {
        const days = Math.max(0, (d.getTime() - startDate.getTime()) / 86400000)
        return principal + principal * rate * (days / 365)
      }

      const points: { date: string; value: number; invested: number }[] = [
        { date: toDateStr(startDate), value: principal, invested: principal },
      ]

      const cur = new Date(startDate)
      cur.setMonth(cur.getMonth() + 1)
      while (cur <= endDate) {
        points.push({ date: toDateStr(cur), value: tdValueAt(cur), invested: principal })
        cur.setMonth(cur.getMonth() + 1)
      }

      const endStr = toDateStr(endDate)
      if (!points.some((p) => p.date === endStr)) {
        points.push({ date: endStr, value: tdValueAt(endDate), invested: principal })
      }

      // Deduplicate by date (keep last) and sort
      const byDate = new Map<string, { value: number; invested: number }>()
      for (const p of points) byDate.set(p.date, { value: p.value, invested: p.invested })
      return Response.json(
        Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({ date, ...v }))
      )
    }

    // Fallback: TD without parameters, use snapshots
    const snapshots = await prisma.portfolioSnapshot.findMany({
      where: { portfolioId: id },
      orderBy: { date: 'asc' },
    })
    return Response.json(
      snapshots.map((s) => ({
        date: s.date.toISOString().split('T')[0],
        value: s.value,
        invested: s.invested,
      }))
    )
  }

  // SHARES portfolios: reconstruct value from transaction history × HistoricalPrice.
  // This avoids the stale-price problem from snapshot carry-forward.
  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'asc' },
    select: { type: true, ticker: true, date: true, quantity: true, price: true, fees: true, amount: true },
  })

  if (transactions.length === 0) return Response.json([])

  const tickerSet = new Set(transactions.map(t => t.ticker))

  const [historicalPrices, priceCacheRows] = await Promise.all([
    prisma.historicalPrice.findMany({
      where: { ticker: { in: [...tickerSet] } },
      orderBy: [{ ticker: 'asc' }, { date: 'asc' }],
      select: { ticker: true, date: true, close: true },
    }),
    prisma.priceCache.findMany({
      where: { ticker: { in: [...tickerSet] } },
      select: { ticker: true, price: true },
    }),
  ])

  // Build price map: ticker -> [{date, close}] sorted ascending
  const priceMap = new Map<string, { date: string; close: number }[]>()
  for (const hp of historicalPrices) {
    const d = toDateStr(hp.date)
    if (!priceMap.has(hp.ticker)) priceMap.set(hp.ticker, [])
    priceMap.get(hp.ticker)!.push({ date: d, close: hp.close })
  }

  // Current prices — used for today's data point and as fallback for tickers
  // with no HistoricalPrice records
  const priceCacheMap = new Map<string, number>()
  for (const pc of priceCacheRows) priceCacheMap.set(pc.ticker, Number(pc.price))

  // All dates where we have at least one price, plus today
  const todayStr = toDateStr(new Date())
  const allPriceDatesSet = new Set<string>([todayStr])
  for (const prices of priceMap.values()) {
    for (const p of prices) allPriceDatesSet.add(p.date)
  }
  const sortedPriceDates = [...allPriceDatesSet].sort()

  // Separate holding transactions (affect value) from income transactions (DIVIDEND/DRP)
  const holdingTxns = transactions.filter(t => t.type === 'BUY' || t.type === 'SELL' || t.type === 'DRP')
  const allTxns = transactions  // needed to compute income

  if (holdingTxns.length === 0) return Response.json([])

  const firstDate = toDateStr(holdingTxns[0].date)
  const holdingsMap = new Map<string, number>()
  let invested = 0
  let cumulativeIncome = 0
  let holdingIdx = 0
  let incomeIdx = 0
  const result: { date: string; value: number; invested: number; income: number }[] = []

  for (const date of sortedPriceDates) {
    if (date < firstDate) continue

    // Apply all holding transactions on or before this date
    while (holdingIdx < holdingTxns.length && toDateStr(holdingTxns[holdingIdx].date) <= date) {
      const t = holdingTxns[holdingIdx]
      const qty = Number(t.quantity)
      const price = Number(t.price)
      const fees = Number(t.fees)
      const current = holdingsMap.get(t.ticker) ?? 0
      if (t.type === 'BUY') {
        holdingsMap.set(t.ticker, current + qty)
        invested += qty * price + fees
      } else if (t.type === 'DRP') {
        holdingsMap.set(t.ticker, current + qty)
        invested += qty * price
      } else {
        holdingsMap.set(t.ticker, Math.max(0, current - qty))
      }
      holdingIdx++
    }

    // Accumulate dividend income (DIVIDEND + DRP amount) up to this date
    while (incomeIdx < allTxns.length && toDateStr(allTxns[incomeIdx].date) <= date) {
      const t = allTxns[incomeIdx]
      if (t.type === 'DIVIDEND') {
        cumulativeIncome += Number(t.amount ?? 0)
      } else if (t.type === 'DRP') {
        // DRP amount = original dividend cash value
        const drpIncome = t.amount != null
          ? Number(t.amount)
          : Number(t.quantity) * Number(t.price)
        cumulativeIncome += drpIncome
      }
      incomeIdx++
    }

    // Value = sum(holdings * price) on this date.
    // Priority: (1) PriceCache for today, (2) HistoricalPrice carry-forward,
    // (3) PriceCache constant for tickers with no historical data.
    let value = 0
    for (const [ticker, qty] of holdingsMap) {
      if (qty <= 0) continue
      let price: number | null = null
      if (date === todayStr) {
        price = priceCacheMap.get(ticker) ?? null
      }
      if (price === null) {
        const prices = priceMap.get(ticker)
        if (prices && prices.length > 0) price = carryForwardClose(prices, date)
      }
      if (price === null) price = priceCacheMap.get(ticker) ?? null
      if (price !== null) value += qty * price
    }

    if (value > 0) {
      result.push({ date, value, invested, income: cumulativeIncome })
    }
  }

  // Fallback: if no HistoricalPrice data at all, return snapshots
  if (result.length === 0) {
    const snapshots = await prisma.portfolioSnapshot.findMany({
      where: { portfolioId: id },
      orderBy: { date: 'asc' },
    })
    return Response.json(
      snapshots.map((s) => ({
        date: s.date.toISOString().split('T')[0],
        value: s.value,
        invested: s.invested,
      }))
    )
  }

  return Response.json(result)
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function carryForwardClose(prices: { date: string; close: number }[], targetDate: string): number | null {
  let result: number | null = null
  for (const p of prices) {
    if (p.date <= targetDate) result = p.close
    else break
  }
  return result
}
