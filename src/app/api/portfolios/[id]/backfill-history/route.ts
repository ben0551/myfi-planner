import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getYfHistoryFull, getYfHistoryFromDate } from '@/lib/yahoo'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({ where: { id } })
  if (!portfolio || portfolio.userId !== session.user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'asc' },
    select: { type: true, ticker: true, date: true, quantity: true, price: true, fees: true },
  })

  if (transactions.length === 0) return Response.json({ snapshots: 0 })

  const tickers = [...new Set(transactions.map((t) => t.ticker.toUpperCase()))]
  const firstTxDate = transactions[0].date

  // Ensure historical prices are in DB for each ticker, going back to first transaction
  for (const ticker of tickers) {
    const earliest = await prisma.historicalPrice.findFirst({
      where: { ticker, source: 'ASX' },
      orderBy: { date: 'asc' },
      select: { date: true },
    })
    const latest = await prisma.historicalPrice.findFirst({
      where: { ticker, source: 'ASX' },
      orderBy: { date: 'desc' },
      select: { date: true },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const hasSufficientHistory = earliest && earliest.date <= firstTxDate
    const isUpToDate = latest && latest.date >= today

    let points: Awaited<ReturnType<typeof getYfHistoryFull>> = []

    if (!hasSufficientHistory) {
      points = await getYfHistoryFull(ticker)
    } else if (!isUpToDate) {
      points = await getYfHistoryFromDate(ticker, latest!.date)
    }

    for (const point of points) {
      const date = new Date(point.date + 'T00:00:00.000Z')
      await prisma.historicalPrice.upsert({
        where: { ticker_date_source: { ticker, date, source: 'ASX' } },
        update: { close: point.close, open: point.open, high: point.high, low: point.low,
          volume: point.volume != null ? BigInt(Math.round(point.volume)) : null },
        create: { ticker, date, open: point.open, high: point.high, low: point.low,
          close: point.close, volume: point.volume != null ? BigInt(Math.round(point.volume)) : null,
          source: 'ASX' },
      }).catch(() => {})
    }
  }

  // Load all historical prices for these tickers
  const priceRows = await prisma.historicalPrice.findMany({
    where: { ticker: { in: tickers }, source: 'ASX' },
    orderBy: { date: 'asc' },
    select: { ticker: true, date: true, close: true },
  })

  // Build map: ticker → sorted [{date, close}]
  const priceMap = new Map<string, { date: string; close: number }[]>()
  for (const p of priceRows) {
    const dateStr = p.date.toISOString().slice(0, 10)
    const list = priceMap.get(p.ticker) ?? []
    list.push({ date: dateStr, close: p.close })
    priceMap.set(p.ticker, list)
  }

  // Collect all dates >= first transaction date
  const firstTxDateStr = firstTxDate.toISOString().slice(0, 10)
  const allDateSet = new Set<string>()
  for (const [, prices] of priceMap) {
    for (const p of prices) {
      if (p.date >= firstTxDateStr) allDateSet.add(p.date)
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  allDateSet.add(todayStr)
  const sortedDates = Array.from(allDateSet).sort()

  // Sample: daily for last 90 days, weekly for 90d–1y, monthly for > 1y
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const oneYearAgo   = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)

  const sampledDates = sortedDates.filter((d, i) => {
    if (i === 0 || i === sortedDates.length - 1) return true
    if (d >= ninetyDaysAgo) return true
    if (d >= oneYearAgo) {
      const diff = (new Date(d).getTime() - new Date(sortedDates[i - 1]).getTime()) / 86400000
      return diff >= 7
    }
    const prev = new Date(sortedDates[i - 1])
    const cur  = new Date(d)
    return cur.getFullYear() !== prev.getFullYear() || cur.getMonth() !== prev.getMonth()
  })

  // Carry-forward price lookup
  function getPrice(ticker: string, targetDate: string): number | null {
    const prices = priceMap.get(ticker)
    if (!prices?.length) return null
    let result: number | null = null
    for (const p of prices) {
      if (p.date <= targetDate) result = p.close
      else break
    }
    return result
  }

  // Walk through dates applying transactions and computing value
  let txIndex = 0
  const holdings = new Map<string, number>()
  let invested = 0
  let snapshotsCreated = 0

  for (const date of sampledDates) {
    while (txIndex < transactions.length) {
      const tx = transactions[txIndex]
      const txDate = tx.date.toISOString().slice(0, 10)
      if (txDate > date) break
      const ticker = tx.ticker.toUpperCase()
      const qty   = Number(tx.quantity)
      const price = Number(tx.price)
      const fees  = Number(tx.fees)
      if (tx.type === 'BUY') {
        holdings.set(ticker, (holdings.get(ticker) ?? 0) + qty)
        invested += qty * price + fees
      } else if (tx.type === 'SELL') {
        holdings.set(ticker, (holdings.get(ticker) ?? 0) - qty)
        invested -= qty * price - fees
      }
      txIndex++
    }

    let value = 0
    for (const [ticker, qty] of holdings) {
      if (qty <= 0) continue
      const price = getPrice(ticker, date)
      if (price != null) value += qty * price
    }
    if (value <= 0) continue

    const snapshotDate = new Date(date + 'T00:00:00.000Z')
    await prisma.portfolioSnapshot.upsert({
      where: { portfolioId_date: { portfolioId: id, date: snapshotDate } },
      update: { value, invested: Math.max(0, invested) },
      create: { portfolioId: id, date: snapshotDate, value, invested: Math.max(0, invested) },
    })
    snapshotsCreated++
  }

  return Response.json({ snapshots: snapshotsCreated })
}
