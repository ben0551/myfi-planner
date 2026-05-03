import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { calcTermDeposit } from './termDeposit'

const FIXED_NOW = new Date('2026-01-01T00:00:00Z')

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})
afterAll(() => {
  vi.useRealTimers()
})

describe('calcTermDeposit', () => {
  it('computes simple interest accrual mid-term', () => {
    const start = new Date('2025-01-01T00:00:00Z')
    const maturity = new Date('2027-01-01T00:00:00Z') // 730 days total, 365 elapsed
    const r = calcTermDeposit(100_000, 5, start, maturity)

    expect(r.daysElapsed).toBe(365)
    expect(r.daysTotal).toBe(730)
    expect(r.accruedInterest).toBeCloseTo(5_000, 1) // 100k × 5% × 1y
    expect(r.totalInterest).toBeCloseTo(10_000, 1)  // 100k × 5% × 2y
    expect(r.currentValue).toBeCloseTo(105_000, 1)
    expect(r.isMatured).toBe(false)
    expect(r.progressPct).toBeCloseTo(50, 1)
  })

  it('caps at maturity when matured', () => {
    // 2025-01-01 → 2026-01-01 is exactly 365 days (non-leap year), matures at NOW
    const start = new Date('2025-01-01T00:00:00Z')
    const maturity = new Date('2026-01-01T00:00:00Z')
    const r = calcTermDeposit(100_000, 5, start, maturity)

    expect(r.isMatured).toBe(true)
    expect(r.accruedInterest).toBeCloseTo(5_000, 0)
    expect(r.currentValue).toBeCloseTo(105_000, 0)
    expect(r.daysRemaining).toBe(0)
    expect(r.progressPct).toBe(100)
  })

  it('returns zero accrued interest before start date', () => {
    const start = new Date('2027-01-01T00:00:00Z')
    const maturity = new Date('2028-01-01T00:00:00Z')
    const r = calcTermDeposit(50_000, 4, start, maturity)

    expect(r.daysElapsed).toBe(0)
    expect(r.accruedInterest).toBe(0)
    expect(r.currentValue).toBe(50_000)
    expect(r.isMatured).toBe(false)
  })

  it('handles zero rate', () => {
    const start = new Date('2025-01-01T00:00:00Z')
    const maturity = new Date('2027-01-01T00:00:00Z')
    const r = calcTermDeposit(100_000, 0, start, maturity)

    expect(r.accruedInterest).toBe(0)
    expect(r.currentValue).toBe(100_000)
  })

  it('handles same-day start and maturity gracefully', () => {
    const sameDay = new Date('2026-01-01T00:00:00Z')
    const r = calcTermDeposit(10_000, 5, sameDay, sameDay)
    // daysTotal floored to 1 to avoid division by zero
    expect(r.daysTotal).toBe(1)
    expect(Number.isFinite(r.progressPct)).toBe(true)
  })
})
