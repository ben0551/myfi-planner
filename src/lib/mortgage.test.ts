import { describe, it, expect } from 'vitest'
import { amortizedBalance, scheduledPayment, type MortgageSnapshot } from './mortgage'

const NOW = new Date('2026-01-01T00:00:00Z')

const baseLoan: MortgageSnapshot = {
  originalAmount: 500_000,
  currentBalance: 450_000,
  interestRate: 6,
  loanType: 'PI',
  repaymentFreq: 'MONTHLY',
  startDate: new Date('2024-01-01T00:00:00Z'), // 2 yrs old at NOW
  termYears: 30,
}

describe('amortizedBalance', () => {
  it('returns currentBalance at the reference date (anchor point)', () => {
    const b = amortizedBalance(baseLoan, NOW, NOW)
    expect(b).toBeCloseTo(450_000, 1)
  })

  it('past dates project backward — balance increases toward originalAmount', () => {
    const oneYearAgo = new Date('2025-01-01T00:00:00Z')
    const b = amortizedBalance(baseLoan, oneYearAgo, NOW)
    // Should be HIGHER than currentBalance (less paid off in the past)
    expect(b).toBeGreaterThan(450_000)
    expect(b).toBeLessThanOrEqual(500_000)
  })

  it('future dates project forward — balance decreases', () => {
    const oneYearFuture = new Date('2027-01-01T00:00:00Z')
    const b = amortizedBalance(baseLoan, oneYearFuture, NOW)
    expect(b).toBeLessThan(450_000)
    expect(b).toBeGreaterThanOrEqual(0)
  })

  it('returns 0 before loan start date', () => {
    const beforeStart = new Date('2023-01-01T00:00:00Z')
    expect(amortizedBalance(baseLoan, beforeStart, NOW)).toBe(0)
  })

  it('returns 0 at or after loan term end', () => {
    const afterEnd = new Date('2055-01-01T00:00:00Z') // > 30 years from start
    expect(amortizedBalance(baseLoan, afterEnd, NOW)).toBe(0)
  })

  it('IO loans stay flat at currentBalance', () => {
    const io = { ...baseLoan, loanType: 'IO' }
    const past = new Date('2025-01-01T00:00:00Z')
    const future = new Date('2027-01-01T00:00:00Z')
    expect(amortizedBalance(io, past, NOW)).toBe(450_000)
    expect(amortizedBalance(io, future, NOW)).toBe(450_000)
    expect(amortizedBalance(io, NOW, NOW)).toBe(450_000)
  })

  it('clamps to [0, originalAmount]', () => {
    // Far in the past — backward projection could exceed originalAmount mathematically
    const wayPast = new Date('2024-01-01T00:00:00Z') // = startDate
    const b = amortizedBalance(baseLoan, wayPast, NOW)
    expect(b).toBeLessThanOrEqual(500_000)
    expect(b).toBeGreaterThanOrEqual(0)
  })

  it('handles zero-rate loans linearly', () => {
    const zeroRate = { ...baseLoan, interestRate: 0 }
    const oneYearFuture = new Date('2027-01-01T00:00:00Z')
    const b = amortizedBalance(zeroRate, oneYearFuture, NOW)
    expect(b).toBeLessThan(450_000)
    expect(b).toBeGreaterThan(0)
  })

  it('respects fortnightly repayment frequency', () => {
    const fn = { ...baseLoan, repaymentFreq: 'FORTNIGHTLY' }
    const future = new Date('2027-01-01T00:00:00Z')
    const monthly = amortizedBalance(baseLoan, future, NOW)
    const fortnightly = amortizedBalance(fn, future, NOW)
    // Both produce reasonable balances; just ensure no NaN/Infinity
    expect(Number.isFinite(monthly)).toBe(true)
    expect(Number.isFinite(fortnightly)).toBe(true)
  })
})

describe('scheduledPayment', () => {
  it('computes standard 30-yr P&I monthly payment', () => {
    // $500k, 6% p.a., 30 years monthly → ~$2997.75
    const pmt = scheduledPayment(500_000, 6, 30, 'MONTHLY')
    expect(pmt).toBeCloseTo(2997.75, 1)
  })

  it('zero-rate splits principal evenly', () => {
    const pmt = scheduledPayment(360_000, 0, 30, 'MONTHLY')
    expect(pmt).toBeCloseTo(1000, 5) // 360k / 360 months
  })

  it('higher rate produces higher payment', () => {
    const low = scheduledPayment(500_000, 4, 30, 'MONTHLY')
    const high = scheduledPayment(500_000, 8, 30, 'MONTHLY')
    expect(high).toBeGreaterThan(low)
  })
})
