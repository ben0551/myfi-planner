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

  // All dividend + DRP transactions across all of this user's portfolios
  const dividends = await prisma.transaction.findMany({
    where: {
      type: { in: ['DIVIDEND', 'DRP'] },
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
    // DRP: use amount if set, otherwise qty × price
    const amount = d.amount
      ? Number(d.amount)
      : d.type === 'DRP'
        ? Number(d.quantity) * Number(d.price)
        : 0
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
    if (tx.type === 'BUY' || tx.type === 'DRP') holdingQty.set(t, (holdingQty.get(t) ?? 0) + qty)
    else if (tx.type === 'SELL') holdingQty.set(t, Math.max(0, (holdingQty.get(t) ?? 0) - qty))
  }
  const heldTickers = new Set([...holdingQty.entries()].filter(([, q]) => q > 0.00001).map(([t]) => t))

  for (const d of dividends) {
    const date = new Date(d.date)
    if (date < cutoff24m) continue
    const ticker = d.ticker.toUpperCase()
    if (!heldTickers.has(ticker)) continue
    if (!tickerDivMap.has(ticker)) tickerDivMap.set(ticker, [])
    const amount = d.amount
      ? Number(d.amount)
      : d.type === 'DRP'
        ? Number(d.quantity) * Number(d.price)
        : 0
    tickerDivMap.get(ticker)!.push({ date, amount })
  }

  // Build projected month map: "YYYY-MM" → projected amount
  const projectedMap = new Map<string, number>()
  const byTicker: TickerProjection[] = []

  const cutoff12m = new Date(now)
  cutoff12m.setMonth(cutoff12m.getMonth() - 12)

  for (const [ticker, payments] of tickerDivMap) {
    if (payments.length === 0) continue
    const sorted = [...payments].sort((a, b) => a.date.getTime() - b.date.getTime())

    // Prefer recent 12-month history; fall back to all available (up to 24 months)
    // so tickers whose last dividend was 13-24 months ago still get projected
    const recentPayments = sorted.filter((p) => p.date >= cutoff12m)
    const paymentsForProjection = recentPayments.length > 0 ? recentPayments : sorted

    // Sum amounts by calendar month — handles multiple portfolios holding same stock
    const monthTotals = new Map<number, number>()
    for (const p of paymentsForProjection) {
      const m = p.date.getUTCMonth() + 1
      monthTotals.set(m, (monthTotals.get(m) ?? 0) + p.amount)
    }
    if (monthTotals.size === 0) continue

    const payMonths = [...monthTotals.keys()]
    const annualTotal = [...monthTotals.values()].reduce((s, a) => s + a, 0)

    byTicker.push({
      ticker,
      annualEstimate: annualTotal,
      lastPayment: sorted[sorted.length - 1].amount,
      paymentsPerYear: payMonths.length,
    })

    // Project each payment month forward: if already passed this year → next year
    for (const payMonth of payMonths) {
      const projYear = payMonth <= thisMonth ? thisYear + 1 : thisYear
      const key = `${projYear}-${String(payMonth).padStart(2, '0')}`
      projectedMap.set(key, (projectedMap.get(key) ?? 0) + (monthTotals.get(payMonth) ?? 0))
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
