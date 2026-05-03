/**
 * Mortgage amortization helpers.
 * Pure functions — no DB access.
 */

export interface MortgageSnapshot {
  originalAmount: number
  currentBalance: number
  interestRate: number      // annual %
  loanType: string          // 'PI' | 'IO'
  repaymentFreq: string     // 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'
  startDate: Date
  termYears: number
}

function periodsPerYear(freq: string): number {
  return freq === 'WEEKLY' ? 52 : freq === 'FORTNIGHTLY' ? 26 : 12
}

/**
 * Estimates the mortgage balance at `atDate`.
 *
 * Anchors to `currentBalance` at the reference date `now` (default: actual now), then:
 *   - Past dates  → project backward: B(T−k) = (currentBalance + PMT·((1+r)^k−1)/r) / (1+r)^k
 *   - Future dates → project forward: B(T+j) = currentBalance·(1+r)^j − PMT·((1+r)^j−1)/r
 *
 * Extra payments are implicitly reflected (they've already lowered currentBalance);
 * the chart always passes through the actual current balance. Rate changes and
 * payment history are not tracked individually — this is an estimate, not a ledger.
 *
 * Result clamped to [0, originalAmount].
 */
export function amortizedBalance(
  m: MortgageSnapshot,
  atDate: Date,
  now: Date = new Date(),
): number {
  const ppy = periodsPerYear(m.repaymentFreq)
  const startMs = m.startDate.getTime()
  const atMs = atDate.getTime()
  const elapsed = ((atMs - startMs) / (365.25 * 24 * 3600 * 1000)) * ppy

  if (elapsed < 0) return 0
  if (m.loanType === 'IO') return m.currentBalance

  const n = m.termYears * ppy
  if (elapsed >= n) return 0

  const r = m.interestRate / 100 / ppy
  const todayElapsed = ((now.getTime() - startMs) / (365.25 * 24 * 3600 * 1000)) * ppy

  if (r === 0) {
    const remainingPeriods = Math.max(1, n - todayElapsed)
    const pmt0 = m.currentBalance / remainingPeriods
    return Math.max(0, Math.min(m.originalAmount, m.currentBalance + pmt0 * (todayElapsed - elapsed)))
  }

  const pmt = (m.originalAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  const periodsFromToday = elapsed - todayElapsed

  let balance: number
  if (periodsFromToday <= 0) {
    const k = -periodsFromToday
    const factor = Math.pow(1 + r, k)
    balance = (m.currentBalance + pmt * (factor - 1) / r) / factor
  } else {
    const factor = Math.pow(1 + r, periodsFromToday)
    balance = m.currentBalance * factor - pmt * (factor - 1) / r
  }

  return Math.max(0, Math.min(m.originalAmount, balance))
}

/** Standard P&I scheduled payment per period. */
export function scheduledPayment(
  originalAmount: number,
  annualRatePct: number,
  termYears: number,
  freq: string,
): number {
  const ppy = periodsPerYear(freq)
  const n = termYears * ppy
  const r = annualRatePct / 100 / ppy
  if (r === 0) return originalAmount / n
  return (originalAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}
