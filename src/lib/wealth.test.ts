import { describe, it, expect } from 'vitest'
import {
  computeNetWorth,
  computeFireProjection,
  inheritancesToLumpSums,
  generateProjectionSeries,
  type WealthSnapshot,
  type FireInputs,
} from './wealth'

const baseSnap: WealthSnapshot = {
  sharesValue: 100_000,
  tdValue: 50_000,
  propertyEquity: 200_000,
  superBalance: 80_000,
  cashBalance: 20_000,
  propertyDebt: 300_000,
  propertyGrossValue: 500_000,
}

describe('computeNetWorth', () => {
  it('sums all components when all flags on', () => {
    const nw = computeNetWorth(baseSnap, {
      includePropertyEquity: true, includeSuper: true, includeCash: true,
    })
    expect(nw).toBe(450_000)
  })

  it('excludes super when flag off', () => {
    const nw = computeNetWorth(baseSnap, {
      includePropertyEquity: true, includeSuper: false, includeCash: true,
    })
    expect(nw).toBe(370_000)
  })

  it('excludes property equity when flag off', () => {
    const nw = computeNetWorth(baseSnap, {
      includePropertyEquity: false, includeSuper: true, includeCash: true,
    })
    expect(nw).toBe(250_000)
  })

  it('shares + TD always included', () => {
    const nw = computeNetWorth(baseSnap, {
      includePropertyEquity: false, includeSuper: false, includeCash: false,
    })
    expect(nw).toBe(150_000)
  })
})

describe('inheritancesToLumpSums', () => {
  it('converts year offsets to months and applies probability', () => {
    const lumps = inheritancesToLumpSums(
      [{ amount: 100_000, expectedYear: 2030, probability: 50 }],
      2026,
    )
    expect(lumps).toEqual([{ atMonth: 48, amount: 50_000 }])
  })

  it('clamps past-year inheritances to atMonth=0', () => {
    const lumps = inheritancesToLumpSums(
      [{ amount: 100_000, expectedYear: 2020, probability: 100 }],
      2026,
    )
    expect(lumps[0].atMonth).toBe(0)
  })
})

describe('computeFireProjection', () => {
  const baseInputs: FireInputs = {
    annualExpenses: 50_000,
    withdrawalRate: 4.0,
    expectedReturn: 7.0,
    inflationRate: 3.0,
    monthlySavings: 2_000,
    currentAge: 30,
  }

  it('computes FIRE number via 4% rule', () => {
    const r = computeFireProjection(0, baseInputs)
    expect(r.fireNumber).toBe(1_250_000) // 50k / 0.04
  })

  it('returns months=0 if already at FIRE', () => {
    const r = computeFireProjection(2_000_000, baseInputs)
    expect(r.monthsToFire).toBe(0)
    expect(r.projectedFireAge).toBe(30)
  })

  it('projects forward when below FIRE number', () => {
    const r = computeFireProjection(100_000, baseInputs)
    expect(r.monthsToFire).toBeGreaterThan(0)
    expect(r.monthsToFire).toBeLessThan(600)
    expect(r.projectedFireAge).toBeGreaterThan(30)
  })

  it('reports null when never reachable (zero savings, zero return)', () => {
    const r = computeFireProjection(100_000, {
      ...baseInputs, monthlySavings: 0, expectedReturn: 0, inflationRate: 0,
    })
    expect(r.monthsToFire).toBe(null)
  })

  it('computes valueAtTargetAge when targetRetireAge set', () => {
    const r = computeFireProjection(100_000, {
      ...baseInputs, targetRetireAge: 60,
    })
    expect(r.valueAtTargetAge).not.toBeNull()
    expect(r.valueAtTargetAge!).toBeGreaterThan(100_000)
    expect(r.shortfallAtTargetAge).not.toBeNull()
  })

  it('uses superGrowthRate separately from main return', () => {
    const without = computeFireProjection(100_000, {
      ...baseInputs, superBalance: 200_000,
    })
    const withFastSuper = computeFireProjection(100_000, {
      ...baseInputs, superBalance: 200_000, superGrowthRate: 12,
    })
    // Faster super growth = FIRE sooner
    expect(withFastSuper.monthsToFire!).toBeLessThan(without.monthsToFire!)
  })

  it('lumpSums shorten time to FIRE', () => {
    const without = computeFireProjection(100_000, baseInputs)
    const withLump = computeFireProjection(100_000, {
      ...baseInputs,
      lumpSums: [{ atMonth: 60, amount: 500_000 }],
    })
    expect(withLump.monthsToFire!).toBeLessThan(without.monthsToFire!)
  })
})

describe('generateProjectionSeries', () => {
  it('returns at least one point per month up to FIRE', () => {
    const inputs: FireInputs = {
      annualExpenses: 50_000, withdrawalRate: 4.0,
      expectedReturn: 7.0, inflationRate: 3.0,
      monthlySavings: 2_000, currentAge: 30,
    }
    const series = generateProjectionSeries(100_000, 1_250_000, inputs, 360)
    expect(series.length).toBeGreaterThan(0)
    // Monotonically increasing while accumulating
    expect(series[10].value).toBeGreaterThanOrEqual(series[5].value)
    // withoutContributions <= value (because contributions add)
    expect(series.at(-1)!.withoutContributions).toBeLessThanOrEqual(series.at(-1)!.value)
  })
})
