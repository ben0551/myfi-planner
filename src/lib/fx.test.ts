import { describe, it, expect } from 'vitest'
import { convertWithMap } from './fx'

describe('convertWithMap', () => {
  // ECB-style EUR-base rates (1 EUR = X target)
  const rates = new Map<string, number>([
    ['AUD', 1.6589],
    ['USD', 1.0810],
    ['NZD', 1.8000],
  ])

  it('returns the original amount when from === to', () => {
    expect(convertWithMap(100, 'AUD', 'AUD', rates)).toBe(100)
  })

  it('converts EUR to target', () => {
    expect(convertWithMap(100, 'EUR', 'AUD', rates)).toBeCloseTo(165.89, 2)
  })

  it('converts target to EUR', () => {
    expect(convertWithMap(165.89, 'AUD', 'EUR', rates)).toBeCloseTo(100, 1)
  })

  it('converts cross-currency via EUR', () => {
    // $100 USD = (100 / 1.0810) EUR ≈ €92.51, then × 1.6589 = $153.46 AUD
    expect(convertWithMap(100, 'USD', 'AUD', rates)).toBeCloseTo(153.46, 1)
  })

  it('returns unchanged amount when rates are missing', () => {
    expect(convertWithMap(100, 'JPY', 'AUD', rates)).toBe(100)
    expect(convertWithMap(100, 'USD', 'JPY', rates)).toBe(100)
  })

  it('zero amount short-circuits', () => {
    expect(convertWithMap(0, 'USD', 'JPY', rates)).toBe(0)
  })
})
