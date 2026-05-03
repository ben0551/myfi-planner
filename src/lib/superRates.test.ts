import { describe, it, expect } from 'vitest'
import { sgRateForFy, currentSgRate, fyEndYear } from './superRates'

describe('fyEndYear', () => {
  it('Jul/Aug/.../Dec → next year', () => {
    expect(fyEndYear(new Date('2025-07-01'))).toBe(2026)
    expect(fyEndYear(new Date('2025-12-31'))).toBe(2026)
  })
  it('Jan/.../Jun → same year', () => {
    expect(fyEndYear(new Date('2026-01-01'))).toBe(2026)
    expect(fyEndYear(new Date('2026-06-30'))).toBe(2026)
  })
})

describe('sgRateForFy', () => {
  it('returns legislated rates for known years', () => {
    expect(sgRateForFy(2022)).toBe(10.0)
    expect(sgRateForFy(2023)).toBe(10.5)
    expect(sgRateForFy(2024)).toBe(11.0)
    expect(sgRateForFy(2025)).toBe(11.5)
    expect(sgRateForFy(2026)).toBe(12.0)
  })
  it('returns 12% for future years (legislated cap)', () => {
    expect(sgRateForFy(2030)).toBe(12.0)
    expect(sgRateForFy(2050)).toBe(12.0)
  })
  it('falls back to earliest known rate for years before schedule', () => {
    expect(sgRateForFy(2010)).toBe(10.0)
  })
})

describe('currentSgRate', () => {
  it('returns 12% for FY2025-26 (May 2026)', () => {
    expect(currentSgRate(new Date('2026-05-04'))).toBe(12.0)
  })
  it('returns 11.5% for FY2024-25 (Mar 2025)', () => {
    expect(currentSgRate(new Date('2025-03-01'))).toBe(11.5)
  })
})
