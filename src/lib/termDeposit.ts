export interface TdCalc {
  currentValue: number
  accruedInterest: number
  totalInterest: number
  progressPct: number
  isMatured: boolean
  daysElapsed: number
  daysTotal: number
  daysRemaining: number
}

/**
 * Calculate current value and interest for a term deposit.
 * Uses simple interest: principal × rate/100 × days/365
 */
export function calcTermDeposit(
  principal: number,
  annualRatePct: number,
  startDate: Date,
  maturityDate: Date
): TdCalc {
  const now = new Date()
  const isMatured = now >= maturityDate
  const effectiveNow = isMatured ? maturityDate : now

  const daysTotal    = Math.max(1, (maturityDate.getTime() - startDate.getTime())  / 86400000)
  const daysElapsed  = Math.max(0, (effectiveNow.getTime()  - startDate.getTime()) / 86400000)
  const daysRemaining = Math.max(0, (maturityDate.getTime() - now.getTime())       / 86400000)

  const rate = annualRatePct / 100
  const accruedInterest = principal * rate * (daysElapsed / 365)
  const totalInterest   = principal * rate * (daysTotal   / 365)

  return {
    currentValue: principal + accruedInterest,
    accruedInterest,
    totalInterest,
    progressPct: Math.min(100, (daysElapsed / daysTotal) * 100),
    isMatured,
    daysElapsed: Math.round(daysElapsed),
    daysTotal:   Math.round(daysTotal),
    daysRemaining: Math.ceil(daysRemaining),
  }
}
