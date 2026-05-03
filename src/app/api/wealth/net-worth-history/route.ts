import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // ── Fetch all raw historical sources ────────────────────────────────────────

  const [portfolios, superAccounts, properties, cashAccounts] = await Promise.all([
    prisma.portfolio.findMany({
      where: { userId },
      include: {
        // snapshots used only for TERM_DEPOSIT portfolios (no HistoricalPrice data)
        snapshots: { orderBy: { date: 'asc' }, select: { date: true, value: true } },
      },
    }),
    prisma.superAccount.findMany({
      where: { userId },
      include: {
        balanceHistory: { orderBy: { date: 'asc' }, select: { date: true, balance: true } },
      },
    }),
    prisma.property.findMany({
      where: { userId },  // include sold properties so history isn't erased
      include: {
        valueHistory: { orderBy: { date: 'asc' }, select: { date: true, value: true } },
        mortgage: {
          select: {
            originalAmount: true,
            currentBalance: true,
            interestRate: true,
            loanType: true,
            repaymentFreq: true,
            startDate: true,
            termYears: true,
          },
        },
      },
    }),
    prisma.cashAccount.findMany({
      where: { userId },
      include: {
        balanceHistory: { orderBy: { date: 'asc' }, select: { date: true, balance: true } },
      },
    }),
  ])

  // ── Build per-source histories as { date: string, value: number }[] ─────────

  // TERM_DEPOSIT portfolios: compute history from the TD's own parameters (principal, rate,
  // start/maturity dates). This gives correct history from tdStartDate regardless of whether
  // the portfolio page has ever been visited. Monthly data points give smooth chart growth.
  // Fallback to snapshots only when TD parameters are incomplete.
  type PortfolioHistory = { date: string; value: number }[]
  const tdHistories: PortfolioHistory[] = []

  for (const p of portfolios) {
    if (p.portfolioType !== 'TERM_DEPOSIT') continue

    if (p.tdPrincipal && p.tdRate && p.tdStartDate && p.tdMaturityDate) {
      const principal    = p.tdPrincipal
      const rate         = p.tdRate / 100
      const startDate    = p.tdStartDate
      const maturityDate = p.tdMaturityDate
      const today        = new Date()
      const endDate      = today < maturityDate ? today : maturityDate

      function tdValueAt(d: Date): number {
        const days = Math.max(0, (d.getTime() - startDate.getTime()) / 86400000)
        return principal + principal * rate * (days / 365)
      }

      const hist: PortfolioHistory = [{ date: toDateStr(startDate), value: principal }]

      // Monthly data points from start to end
      const cur = new Date(startDate)
      cur.setMonth(cur.getMonth() + 1)
      while (cur <= endDate) {
        hist.push({ date: toDateStr(cur), value: tdValueAt(cur) })
        cur.setMonth(cur.getMonth() + 1)
      }

      // Ensure today/maturity endpoint is included
      const endStr = toDateStr(endDate)
      if (!hist.some((h) => h.date === endStr)) {
        hist.push({ date: endStr, value: tdValueAt(endDate) })
      }

      // Deduplicate by date (keep last) and sort ascending
      const byDate = new Map<string, number>()
      for (const h of hist) byDate.set(h.date, h.value)
      tdHistories.push(
        Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({ date, value }))
      )
    } else if (p.snapshots.length > 0) {
      // TD without full parameters: fall back to snapshots
      tdHistories.push(
        p.snapshots
          .map((s) => ({ date: toDateStr(s.date), value: s.value }))
          .sort((a, b) => a.date.localeCompare(b.date))
      )
    }
  }

  // SHARES portfolios: reconstruct value from transaction history × HistoricalPrice records.
  // This avoids the stale-price problem that arises from snapshot carry-forward, where a
  // snapshot written on a day with a cached (not freshly synced) price would be propagated
  // to all subsequent dates.
  const sharesByDate = new Map<string, number>()
  const sharesPortfolioIds = portfolios
    .filter(p => p.portfolioType !== 'TERM_DEPOSIT')
    .map(p => p.id)

  if (sharesPortfolioIds.length > 0) {
    const transactions = await prisma.transaction.findMany({
      where: {
        portfolioId: { in: sharesPortfolioIds },
        type: { in: ['BUY', 'SELL', 'DRP'] },
      },
      orderBy: { date: 'asc' },
      select: { portfolioId: true, type: true, ticker: true, date: true, quantity: true },
    })

    const tickerSet = new Set(transactions.map(t => t.ticker))

    if (tickerSet.size > 0) {
      const [historicalPrices, priceCacheRows] = await Promise.all([
        prisma.historicalPrice.findMany({
          where: { ticker: { in: [...tickerSet] } },
          orderBy: [{ ticker: 'asc' }, { date: 'asc' }],
          select: { ticker: true, date: true, close: true },
        }),
        // PriceCache gives accurate current prices for all tickers, including those
        // that may lack HistoricalPrice records (e.g. recently added, never synced)
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

      // Current price lookup (used for today's data point and as fallback for tickers
      // with no historical price records)
      const priceCacheMap = new Map<string, number>()
      for (const pc of priceCacheRows) priceCacheMap.set(pc.ticker, Number(pc.price))

      // Collect all dates where we have at least one price, plus today
      const todayStr = toDateStr(new Date())
      const allPriceDatesSet = new Set<string>([todayStr])
      for (const prices of priceMap.values()) {
        for (const p of prices) allPriceDatesSet.add(p.date)
      }
      const sortedPriceDates = [...allPriceDatesSet].sort()

      // Group transactions by portfolio
      const txnsByPortfolio = new Map<string, typeof transactions>()
      for (const t of transactions) {
        if (!txnsByPortfolio.has(t.portfolioId)) txnsByPortfolio.set(t.portfolioId, [])
        txnsByPortfolio.get(t.portfolioId)!.push(t)
      }

      for (const portfolioId of sharesPortfolioIds) {
        const txns = txnsByPortfolio.get(portfolioId) ?? []
        if (txns.length === 0) continue

        const firstDate = toDateStr(txns[0].date)
        const holdingsMap = new Map<string, number>()
        let txnIdx = 0

        for (const date of sortedPriceDates) {
          if (date < firstDate) continue

          // Apply all transactions whose date falls on or before this price date
          while (txnIdx < txns.length && toDateStr(txns[txnIdx].date) <= date) {
            const t = txns[txnIdx]
            const qty = Number(t.quantity)
            const current = holdingsMap.get(t.ticker) ?? 0
            if (t.type === 'BUY' || t.type === 'DRP') {
              holdingsMap.set(t.ticker, current + qty)
            } else {
              holdingsMap.set(t.ticker, Math.max(0, current - qty))
            }
            txnIdx++
          }

          // Value = sum(holdings * price) at this date.
          // Priority: (1) PriceCache for today, (2) HistoricalPrice carry-forward,
          // (3) PriceCache as constant fallback for tickers with no historical data.
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
            // Last resort: use current PriceCache price as constant for tickers that
            // have never been synced to HistoricalPrice. Imprecise historically but
            // far better than omitting the holding entirely.
            if (price === null) price = priceCacheMap.get(ticker) ?? null
            if (price !== null) value += qty * price
          }

          if (value > 0) {
            sharesByDate.set(date, (sharesByDate.get(date) ?? 0) + value)
          }
        }
      }
    }

    // Fallback: if no HistoricalPrice data exists, use snapshots
    if (sharesByDate.size === 0) {
      for (const p of portfolios) {
        if (p.portfolioType === 'TERM_DEPOSIT') continue
        for (const s of p.snapshots) {
          const d = toDateStr(s.date)
          sharesByDate.set(d, (sharesByDate.get(d) ?? 0) + s.value)
        }
      }
    }
  }

  const sharesHistory = mapToSortedArray(sharesByDate)

  // Sum super balances by date (most recent entry per account per date, then sum across accounts)
  const superByDate = new Map<string, number>()
  for (const a of superAccounts) {
    for (const h of a.balanceHistory) {
      const d = toDateStr(h.date)
      superByDate.set(d, (superByDate.get(d) ?? 0) + h.balance)
    }
    // Ensure current balance is represented at today even if no history entry today
    if (a.balanceHistory.length === 0) {
      // No history at all — use createdAt as start date with current balance
      const d = toDateStr(a.balanceUpdatedAt ?? new Date())
      superByDate.set(d, (superByDate.get(d) ?? 0) + a.currentBalance)
    }
  }
  const superHistory = mapToSortedArray(superByDate)

  // Build per-property histories so sold properties stop contributing after their soldDate
  type PropHistory = {
    history: { date: string; value: number }[]
    soldDateStr: string | null
    mortgage: MortgageSnapshot | null
    ownershipPct: number
  }
  const perPropertyHistories: PropHistory[] = []
  for (const p of properties) {
    const pct = p.ownershipPct / 100
    const soldDateStr = p.soldDate ? toDateStr(p.soldDate) : null

    let history: { date: string; value: number }[]
    if (p.valueHistory.length > 0) {
      history = p.valueHistory
        .filter((h) => !soldDateStr || toDateStr(h.date) <= soldDateStr)
        .map((h) => ({ date: toDateStr(h.date), value: h.value * pct }))
    } else if (!soldDateStr) {
      history = [{ date: toDateStr(p.createdAt), value: p.currentValue * pct }]
    } else {
      history = []
    }
    perPropertyHistories.push({ history, soldDateStr, mortgage: p.mortgage ?? null, ownershipPct: pct })
  }

  // Collect all property dates so they appear in sortedDates
  const propertyAllDates = new Set<string>()
  for (const { history } of perPropertyHistories) {
    for (const h of history) propertyAllDates.add(h.date)
  }

  // Sum cash balances by date
  const cashByDate = new Map<string, number>()
  for (const a of cashAccounts) {
    for (const h of a.balanceHistory) {
      const d = toDateStr(h.date)
      cashByDate.set(d, (cashByDate.get(d) ?? 0) + h.balance)
    }
    if (a.balanceHistory.length === 0) {
      const d = toDateStr(a.createdAt)
      cashByDate.set(d, (cashByDate.get(d) ?? 0) + a.balance)
    }
  }
  const cashHistory = mapToSortedArray(cashByDate)

  // ── Collect all unique dates, sorted ─────────────────────────────────────────

  const allDates = new Set<string>()
  for (const h of sharesHistory)               allDates.add(h.date)
  for (const hist of tdHistories) { for (const h of hist) allDates.add(h.date) }
  for (const h of superHistory)                allDates.add(h.date)
  for (const d of propertyAllDates) allDates.add(d)
  for (const h of cashHistory)   allDates.add(h.date)

  const sortedDates = Array.from(allDates).sort()
  if (sortedDates.length === 0) return Response.json([])

  // ── Reconstruct net worth at each date using carry-forward ───────────────────
  // For each date, each component uses its last known value on or before that date.

  const result = sortedDates.map((date) => {
    const sharesValue  = carryForward(sharesHistory, date) ?? 0
    const tdValue      = tdHistories.reduce((sum, hist) => sum + (carryForward(hist, date) ?? 0), 0)
    const superBalance = carryForward(superHistory,  date) ?? 0
    const cashBalance  = carryForward(cashHistory,   date) ?? 0
    // Sum each property's carry-forward value and amortized debt, stopping after its soldDate
    let propertyValue = 0
    let totalLiabilities = 0
    const dateObj = new Date(date)
    for (const { history, soldDateStr, mortgage, ownershipPct } of perPropertyHistories) {
      if (soldDateStr && date > soldDateStr) continue  // sold before this date
      propertyValue += carryForward(history, date) ?? 0
      if (mortgage) {
        totalLiabilities += amortizedBalance(mortgage, dateObj) * ownershipPct
      }
    }

    const totalAssets = sharesValue + tdValue + propertyValue + superBalance + cashBalance
    const netWorth = totalAssets - totalLiabilities

    return { date, netWorth, totalAssets, totalLiabilities, sharesValue, tdValue, propertyValue, superBalance, cashBalance }
  })

  // ── Thin down daily data to keep the payload reasonable ─────────────────────
  // Keep all points within the last 90 days; weekly before that; monthly before 1 year.

  const today = new Date()
  const ninetyDaysAgo = toDateStr(new Date(today.getTime() - 90 * 86400000))
  const oneYearAgo = toDateStr(new Date(today.getTime() - 365 * 86400000))

  const thinned = result.filter((r, i) => {
    if (i === 0 || i === result.length - 1) return true  // always keep first & last
    if (r.date >= ninetyDaysAgo) return true              // daily for last 90 days
    if (r.date >= oneYearAgo) return isWeekly(r.date, result[i - 1].date)
    return isMonthly(r.date, result[i - 1].date)
  })

  return Response.json(thinned)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type MortgageSnapshot = {
  originalAmount: number
  currentBalance: number
  interestRate: number
  loanType: string
  repaymentFreq: string
  startDate: Date
  termYears: number
}

/**
 * Estimates the amortized mortgage balance at a given date.
 * For P&I loans uses the standard amortization formula.
 * For IO loans the balance is flat (principal never reduces).
 * Clamps to [0, originalAmount].
 */
function amortizedBalance(m: MortgageSnapshot, atDate: Date): number {
  const periodsPerYear = m.repaymentFreq === 'WEEKLY' ? 52
    : m.repaymentFreq === 'FORTNIGHTLY' ? 26
    : 12  // MONTHLY default

  const startMs = m.startDate.getTime()
  const atMs = atDate.getTime()
  const elapsed = ((atMs - startMs) / (365.25 * 24 * 3600 * 1000)) * periodsPerYear

  // Before mortgage start: no debt yet
  if (elapsed < 0) return 0

  // IO loan: principal never reduces; use currentBalance (reflects any lump-sum reductions)
  if (m.loanType === 'IO') return m.currentBalance

  const r = m.interestRate / 100 / periodsPerYear
  const n = m.termYears * periodsPerYear

  if (elapsed >= n) return 0

  let balance: number
  if (r === 0) {
    // Zero-rate edge case: linear paydown
    balance = m.originalAmount * (1 - elapsed / n)
  } else {
    // Standard amortization: B(t) = P*(1+r)^t - PMT*((1+r)^t - 1)/r
    const pmt = (m.originalAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const factor = Math.pow(1 + r, elapsed)
    balance = m.originalAmount * factor - pmt * (factor - 1) / r
  }

  return Math.max(0, Math.min(m.originalAmount, balance))
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function mapToSortedArray(m: Map<string, number>): { date: string; value: number }[] {
  return Array.from(m.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }))
}

/** Returns the last known value in `history` on or before `targetDate`. */
function carryForward(history: { date: string; value: number }[], targetDate: string): number | null {
  let result: number | null = null
  for (const h of history) {
    if (h.date <= targetDate) result = h.value
    else break
  }
  return result
}

/** Returns the last known close price for a ticker on or before `targetDate`. */
function carryForwardClose(prices: { date: string; close: number }[], targetDate: string): number | null {
  let result: number | null = null
  for (const p of prices) {
    if (p.date <= targetDate) result = p.close
    else break
  }
  return result
}

function isWeekly(date: string, prevDate: string): boolean {
  const diff = (new Date(date).getTime() - new Date(prevDate).getTime()) / 86400000
  return diff >= 7
}

function isMonthly(date: string, prevDate: string): boolean {
  const d = new Date(date)
  const p = new Date(prevDate)
  return d.getFullYear() !== p.getFullYear() || d.getMonth() !== p.getMonth()
}
