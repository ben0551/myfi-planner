import Decimal from 'decimal.js'
import type { Transaction } from '@prisma/client'

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

const CORPORATE_TAX_RATE = new Decimal('0.30')

// ── Financial Year helpers ────────────────────────────────────────────────────

/** Australian FY: 1 Jul (fyYear-1) → 30 Jun fyYear */
export function getFYBounds(fyYear: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(fyYear - 1, 6, 1)),   // 1 July
    end:   new Date(Date.UTC(fyYear, 5, 30, 23, 59, 59, 999)), // 30 June
  }
}

export function getFYLabel(fyYear: number): string {
  return `FY${fyYear - 1}–${String(fyYear).slice(2)}`
}

export function dateToFY(date: Date): number {
  const m = date.getUTCMonth() // 0-indexed; July = 6
  const y = date.getUTCFullYear()
  return m >= 6 ? y + 1 : y   // on/after July → next FY
}

export function currentFY(): number {
  return dateToFY(new Date())
}

export function availableFYs(transactions: Transaction[]): number[] {
  const fys = new Set<number>()
  for (const tx of transactions) fys.add(dateToFY(new Date(tx.date)))
  return [...fys].sort((a, b) => b - a)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CGTEvent {
  sellTxId: string
  ticker: string
  sellDate: Date
  qty: number
  proceeds: number
  costBase: number
  grossGain: number
  acquisitionDate: Date | null
  holdingDays: number
  discountEligible: boolean
  discountApplied: number
  assessableGain: number
}

export interface CGTSummary {
  fy: number
  fyLabel: string
  events: CGTEvent[]
  totalGrossGain: number
  totalDiscountApplied: number
  totalAssessableGain: number  // gains only, post-discount
  totalCapitalLosses: number   // absolute value of losses
  netAssessableGain: number    // max(0, assessable gains − losses)
  netLossCarriedForward: number
}

export interface DividendEvent {
  txId: string
  ticker: string
  date: Date
  cashDividend: number
  frankingPct: number
  frankingCredit: number
  grossedUp: number
}

export interface DividendByTicker {
  ticker: string
  cashTotal: number
  frankingCreditTotal: number
  grossedUpTotal: number
}

export interface DividendSummary {
  fy: number
  fyLabel: string
  events: DividendEvent[]
  byTicker: DividendByTicker[]
  totalCash: number
  totalFrankingCredits: number
  totalGrossedUp: number
}

export interface TaxSummary {
  fy: number
  fyLabel: string
  cgt: CGTSummary
  dividends: DividendSummary
  totalAssessableIncome: number
  totalFrankingCredits: number
  availableFYs: number[]
}

// ── CGT ───────────────────────────────────────────────────────────────────────

interface TickerState {
  quantity: Decimal
  totalCostBasis: Decimal
  avgCost: Decimal
  earliestBuyDate: Date | null  // oldest BUY with unsold shares
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export function computeCGTReport(
  transactions: Transaction[],
  fyYear: number
): CGTSummary {
  const { start, end } = getFYBounds(fyYear)
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const stateMap = new Map<string, TickerState>()

  function getState(ticker: string): TickerState {
    if (!stateMap.has(ticker)) {
      stateMap.set(ticker, {
        quantity: new Decimal(0),
        totalCostBasis: new Decimal(0),
        avgCost: new Decimal(0),
        earliestBuyDate: null,
      })
    }
    return stateMap.get(ticker)!
  }

  const events: CGTEvent[] = []

  for (const tx of sorted) {
    const ticker = tx.ticker.toUpperCase()
    const s = getState(ticker)
    const qty = new Decimal(tx.quantity.toString())
    const price = new Decimal(tx.price.toString())
    const fees = new Decimal(tx.fees.toString())
    const txDate = new Date(tx.date)

    if (tx.type === 'BUY' || tx.type === 'DRP') {
      const cost = tx.type === 'BUY' ? qty.times(price).plus(fees) : qty.times(price)
      const newQty = s.quantity.plus(qty)
      s.totalCostBasis = s.totalCostBasis.plus(cost)
      s.avgCost = newQty.gt(0) ? s.totalCostBasis.dividedBy(newQty) : new Decimal(0)
      s.quantity = newQty
      // Track earliest buy date for this position
      if (s.earliestBuyDate === null) s.earliestBuyDate = txDate

    } else if (tx.type === 'SELL') {
      const proceeds = qty.times(price).minus(fees)
      const costBase = s.avgCost.times(qty)
      const grossGain = proceeds.minus(costBase).toNumber()
      const acquisitionDate = s.earliestBuyDate
      const holdingDays = acquisitionDate ? daysBetween(acquisitionDate, txDate) : 0
      const discountEligible = grossGain > 0 && holdingDays > 365
      const discountApplied = discountEligible ? grossGain * 0.5 : 0
      const assessableGain = grossGain - discountApplied

      // Update state
      const newQty = s.quantity.minus(qty)
      s.totalCostBasis = newQty.gt(0) ? s.avgCost.times(newQty) : new Decimal(0)
      s.quantity = newQty.lt(0) ? new Decimal(0) : newQty
      if (s.quantity.lte(0)) s.earliestBuyDate = null

      // Only record event if the SELL falls in the target FY
      if (txDate >= start && txDate <= end) {
        events.push({
          sellTxId: tx.id,
          ticker,
          sellDate: txDate,
          qty: qty.toNumber(),
          proceeds: proceeds.toNumber(),
          costBase: costBase.toNumber(),
          grossGain,
          acquisitionDate,
          holdingDays,
          discountEligible,
          discountApplied,
          assessableGain,
        })
      }
    }
    // DIVIDEND: no effect on CGT state
  }

  const gains = events.filter((e) => e.grossGain > 0)
  const losses = events.filter((e) => e.grossGain <= 0)

  const totalAssessableGain = gains.reduce((s, e) => s + e.assessableGain, 0)
  const totalCapitalLosses = Math.abs(losses.reduce((s, e) => s + e.grossGain, 0))
  const totalDiscountApplied = gains.reduce((s, e) => s + e.discountApplied, 0)
  const netAssessableGain = Math.max(0, totalAssessableGain - totalCapitalLosses)
  const netLossCarriedForward = Math.max(0, totalCapitalLosses - totalAssessableGain)

  return {
    fy: fyYear,
    fyLabel: getFYLabel(fyYear),
    events,
    totalGrossGain: gains.reduce((s, e) => s + e.grossGain, 0),
    totalDiscountApplied,
    totalAssessableGain,
    totalCapitalLosses,
    netAssessableGain,
    netLossCarriedForward,
  }
}

// ── Dividends ─────────────────────────────────────────────────────────────────

export function computeDividendReport(
  transactions: Transaction[],
  fyYear: number
): DividendSummary {
  const { start, end } = getFYBounds(fyYear)

  const dividends = transactions.filter((tx) => {
    if (tx.type !== 'DIVIDEND' && tx.type !== 'DRP') return false
    const d = new Date(tx.date)
    return d >= start && d <= end
  })

  const events: DividendEvent[] = dividends.map((tx) => {
    // For DRP, the income is the reinvestment amount (tx.amount if set, otherwise qty * price)
    const cashDiv = tx.type === 'DRP'
      ? (tx.amount
          ? new Decimal(tx.amount.toString())
          : new Decimal(tx.quantity.toString()).times(new Decimal(tx.price.toString())))
      : new Decimal(tx.amount?.toString() ?? '0')

    // Prefer the stored frankingCredit dollar amount (captured from broker statement).
    // Fall back to computing from frankingPct for legacy transactions that predate this field.
    const storedCredit = tx.frankingCredit ?? 0
    const frankingPct = tx.frankingPct ?? 0
    const frankingCredit: Decimal = storedCredit > 0
      ? new Decimal(storedCredit.toString())
      : cashDiv
          .dividedBy(new Decimal(1).minus(CORPORATE_TAX_RATE))
          .times(CORPORATE_TAX_RATE)
          .times(new Decimal(frankingPct).dividedBy(100))
    const grossedUp = cashDiv.plus(frankingCredit)

    return {
      txId: tx.id,
      ticker: tx.ticker.toUpperCase(),
      date: new Date(tx.date),
      cashDividend: cashDiv.toNumber(),
      frankingPct,
      frankingCredit: frankingCredit.toDecimalPlaces(2).toNumber(),
      grossedUp: grossedUp.toDecimalPlaces(2).toNumber(),
    }
  })

  // Group by ticker
  const byTickerMap = new Map<string, DividendByTicker>()
  for (const e of events) {
    if (!byTickerMap.has(e.ticker)) {
      byTickerMap.set(e.ticker, { ticker: e.ticker, cashTotal: 0, frankingCreditTotal: 0, grossedUpTotal: 0 })
    }
    const t = byTickerMap.get(e.ticker)!
    t.cashTotal += e.cashDividend
    t.frankingCreditTotal += e.frankingCredit
    t.grossedUpTotal += e.grossedUp
  }
  const byTicker = [...byTickerMap.values()].sort((a, b) => b.cashTotal - a.cashTotal)

  const totalCash = events.reduce((s, e) => s + e.cashDividend, 0)
  const totalFrankingCredits = events.reduce((s, e) => s + e.frankingCredit, 0)
  const totalGrossedUp = events.reduce((s, e) => s + e.grossedUp, 0)

  return {
    fy: fyYear,
    fyLabel: getFYLabel(fyYear),
    events,
    byTicker,
    totalCash,
    totalFrankingCredits,
    totalGrossedUp,
  }
}

// ── Capital Loss Carry-Forward ────────────────────────────────────────────────

/**
 * Computes the net capital loss carried forward into targetFY from all prior FYs.
 * Each FY's losses offset that FY's gains first; any surplus carries to the next year.
 */
export function computeCarriedForwardLoss(
  transactions: Transaction[],
  targetFY: number
): number {
  const priorFYs = availableFYs(transactions)
    .filter((fy) => fy < targetFY)
    .sort((a, b) => a - b)

  let balance = 0
  for (const fy of priorFYs) {
    const report = computeCGTReport(transactions, fy)
    const gainAfterCarry = Math.max(0, report.totalAssessableGain - balance)
    const unabsorbedCarry = Math.max(0, balance - report.totalAssessableGain)
    const netLossThisFY = Math.max(0, report.totalCapitalLosses - gainAfterCarry)
    balance = unabsorbedCarry + netLossThisFY
  }

  return balance
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function computeTaxSummary(
  transactions: Transaction[],
  fyYear: number
): TaxSummary {
  const cgt = computeCGTReport(transactions, fyYear)
  const dividends = computeDividendReport(transactions, fyYear)

  return {
    fy: fyYear,
    fyLabel: getFYLabel(fyYear),
    cgt,
    dividends,
    totalAssessableIncome: cgt.netAssessableGain + dividends.totalGrossedUp,
    totalFrankingCredits: dividends.totalFrankingCredits,
    availableFYs: availableFYs(transactions),
  }
}
