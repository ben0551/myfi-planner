import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface MonthlyIncome {
  year: number
  month: number        // 1–12
  label: string        // "Jan 25"
  actual: number       // sum of dividends received this month (past months)
  projected: number    // estimated income (future months)
  isProjected: boolean
}

export interface TickerProjection {
  ticker: string
  annualEstimate: number
  lastPayment: number
  paymentsPerYear: number
}

export interface IncomeResponse {
  months: MonthlyIncome[]
  trailing12Total: number
  projected12Total: number
  byTicker: TickerProjection[]
  currency: string
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // All dividend transactions across all of this user's portfolios
  const dividends = await prisma.transaction.findMany({
    where: {
      type: 'DIVIDEND',
      portfolio: { userId: session.user.id },
    },
    include: { portfolio: { select: { currency: true } } },
    orderBy: { date: 'asc' },
  })

  // Determine dominant currency (most common across portfolios)
  const currencyCount = new Map<string, number>()
  for (const d of dividends) {
    const c = d.portfolio.currency
    currencyCount.set(c, (currencyCount.get(c) ?? 0) + 1)
  }
  const currency = [...currencyCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'AUD'

  const now = new Date()
  const thisYear = now.getUTCFullYear()
  const thisMonth = now.getUTCMonth() + 1 // 1-indexed

  // Build a map: "YYYY-MM" → total dividend amount
  const actualMap = new Map<string, number>()
  for (const d of dividends) {
    const date = new Date(d.date)
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    const amount = d.amount ? Number(d.amount) : 0
    actualMap.set(key, (actualMap.get(key) ?? 0) + amount)
  }

  // ── Projection logic ──────────────────────────────────────────────────────────
  // For each ticker, look at dividend payments in the last 24 months.
  // Derive payment frequency and average amount, then project forward 12 months
  // using the same calendar months as last year's payments.

  const tickerDivMap = new Map<string, { date: Date; amount: number }[]>()
  const cutoff24m = new Date(now)
  cutoff24m.setMonth(cutoff24m.getMonth() - 24)

  // Also need current holdings to only project for tickers still held
  const allTransactions = await prisma.transaction.findMany({
    where: { portfolio: { userId: session.user.id } },
    orderBy: { date: 'asc' },
  })

  const holdingQty = new Map<string, number>()
  for (const tx of allTransactions) {
    const t = tx.ticker.toUpperCase()
    const qty = Number(tx.quantity)
    if (tx.type === 'BUY') holdingQty.set(t, (holdingQty.get(t) ?? 0) + qty)
    else if (tx.type === 'SELL') holdingQty.set(t, Math.max(0, (holdingQty.get(t) ?? 0) - qty))
  }
  const heldTickers = new Set([...holdingQty.entries()].filter(([, q]) => q > 0.00001).map(([t]) => t))

  for (const d of dividends) {
    const date = new Date(d.date)
    if (date < cutoff24m) continue
    const ticker = d.ticker.toUpperCase()
    if (!heldTickers.has(ticker)) continue
    if (!tickerDivMap.has(ticker)) tickerDivMap.set(ticker, [])
    tickerDivMap.get(ticker)!.push({ date, amount: d.amount ? Number(d.amount) : 0 })
  }

  // Build projected month map: "YYYY-MM" → projected amount
  const projectedMap = new Map<string, number>()
  const byTicker: TickerProjection[] = []

  for (const [ticker, payments] of tickerDivMap) {
    if (payments.length === 0) continue
    const sorted = [...payments].sort((a, b) => a.date.getTime() - b.date.getTime())
    const lastPayment = sorted[sorted.length - 1].amount

    // Find which months (1-12) this ticker paid in the last 12 months
    const cutoff12m = new Date(now)
    cutoff12m.setMonth(cutoff12m.getMonth() - 12)
    const recentPayments = sorted.filter((p) => p.date >= cutoff12m)
    if (recentPayments.length === 0) continue

    const payMonths = recentPayments.map((p) => p.date.getUTCMonth() + 1) // 1-indexed
    const avgAmount = recentPayments.reduce((s, p) => s + p.amount, 0) / recentPayments.length

    byTicker.push({
      ticker,
      annualEstimate: avgAmount * recentPayments.length,
      lastPayment,
      paymentsPerYear: recentPayments.length,
    })

    // Project the same months 12 months forward from now
    for (const payMonth of payMonths) {
      // Find the projected year for this month
      let projYear = thisYear
      let projMonth = payMonth
      // If this month is in the past relative to today, project to next year
      if (payMonth < thisMonth || (payMonth === thisMonth)) {
        projYear = thisYear + 1
      }
      const key = `${projYear}-${String(projMonth).padStart(2, '0')}`
      projectedMap.set(key, (projectedMap.get(key) ?? 0) + avgAmount)
    }
  }

  // ── Assemble 24-month window: 12 past + 12 future ────────────────────────────
  const months: MonthlyIncome[] = []

  for (let i = -11; i <= 12; i++) {
    const d = new Date(Date.UTC(thisYear, thisMonth - 1 + i, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    const label = `${MONTH_LABELS[m - 1]} ${String(y).slice(2)}`
    const isPast = i <= 0
    const actual = isPast ? (actualMap.get(key) ?? 0) : 0
    const projected = !isPast ? (projectedMap.get(key) ?? 0) : 0

    months.push({ year: y, month: m, label, actual, projected, isProjected: !isPast })
  }

  const trailing12Total = months.filter((m) => !m.isProjected).reduce((s, m) => s + m.actual, 0)
  const projected12Total = months.filter((m) => m.isProjected).reduce((s, m) => s + m.projected, 0)

  byTicker.sort((a, b) => b.annualEstimate - a.annualEstimate)

  return Response.json({ months, trailing12Total, projected12Total, byTicker, currency } satisfies IncomeResponse)
}
