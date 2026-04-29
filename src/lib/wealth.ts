/**
 * Net worth + FIRE calculations.
 * Pure functions — no DB access.
 */

export interface WealthSnapshot {
  sharesValue: number          // sum of portfolio market values
  propertyEquity: number       // Σ (currentValue × ownershipPct% − mortgageBalance)
  superBalance: number         // Σ super account balances
  cashBalance: number          // Σ cash account balances
  propertyDebt: number         // Σ mortgage balances (gross)
  propertyGrossValue: number   // Σ (currentValue × ownershipPct%)
}

export function computeNetWorth(
  snap: WealthSnapshot,
  settings: { includePropertyEquity: boolean; includeSuper: boolean; includeCash: boolean }
): number {
  let nw = snap.sharesValue
  if (settings.includePropertyEquity) nw += snap.propertyEquity
  if (settings.includeSuper) nw += snap.superBalance
  if (settings.includeCash) nw += snap.cashBalance
  return nw
}

export interface LumpSum {
  atMonth: number   // months from now (0 = immediate)
  amount: number    // in today's dollars (real)
}

export interface FireInputs {
  annualExpenses: number       // desired annual spend in retirement
  withdrawalRate: number       // e.g. 4.0
  expectedReturn: number       // e.g. 7.0  (nominal annual %)
  inflationRate: number        // e.g. 3.0
  superGrowthRate?: number     // e.g. 9.0 — super grows at its own rate (contributions + returns)
  monthlySavings: number       // net monthly contributions to investable assets (excl. super)
  superBalance?: number        // current super balance — projected separately at superGrowthRate
  currentAge: number
  targetRetireAge?: number | null
  lumpSums?: LumpSum[]         // one-off windfalls (e.g. inheritances)
}

/** Convert anticipated inheritances to LumpSum entries relative to currentYear. */
export function inheritancesToLumpSums(
  inheritances: { amount: number; expectedYear: number; probability: number }[],
  currentYear: number
): LumpSum[] {
  return inheritances.map((i) => ({
    atMonth: Math.max(0, (i.expectedYear - currentYear) * 12),
    amount: i.amount * (i.probability / 100),
  }))
}

export interface FireResult {
  fireNumber: number           // annualExpenses / (withdrawalRate / 100)
  realReturn: number           // (1+nominal)/(1+inflation) - 1, annualised
  monthsToFire: number | null  // null if already there or never (negative savings)
  projectedFireDate: Date | null
  projectedFireAge: number | null
  // "what if I retire at targetRetireAge?"
  valueAtTargetAge: number | null
  shortfallAtTargetAge: number | null
}

export interface BridgeAnalysis {
  /**
   * Month at which the accumulated portfolio + inheritance first reaches the FIRE number.
   * May be earlier than naturalFireMonth if inheritance accelerates FIRE.
   */
  fireWithInheritanceMonth: number | null
  /** Month FIRE would be reached without any inheritance (for comparison). */
  naturalFireMonth: number | null
  /** Months saved vs natural FIRE date. Negative = inheritance arrives too late to help. */
  monthsEarlier: number
  /** Portfolio value at the inheritance arrival month (still accumulating, not drawing down). */
  portfolioAtInheritance: number | null
  /** Combined portfolio + inheritance at arrival. */
  combinedAtInheritance: number | null
  /** Remaining gap after inheritance if FIRE number still not reached at arrival. */
  shortfallAtInheritance: number | null
  /** True if inheritance meaningfully accelerates FIRE (saves at least 1 month). */
  accelerates: boolean
}

/**
 * Simulate continued ACCUMULATION (savings + investment growth) and check whether
 * anticipated inheritances let you reach the FIRE number earlier than you would otherwise.
 *
 * This is NOT a drawdown scenario — you're still working. The question is:
 * "Does the inheritance let me FIRE sooner?"
 */
export function computeBridgeToFire(
  currentNetWorth: number,  // investable assets EXCLUDING super (if superBalance provided)
  inputs: FireInputs,
  fireNumber: number
): BridgeAnalysis | null {
  const lumpSums = (inputs.lumpSums ?? []).filter((ls) => ls.atMonth > 0)
  if (lumpSums.length === 0) return null

  const superBal = inputs.superBalance ?? 0
  if (currentNetWorth + superBal >= fireNumber) return null

  const nominalMonthly = Math.pow(1 + inputs.expectedReturn / 100, 1 / 12) - 1
  const inflationMonthly = Math.pow(1 + inputs.inflationRate / 100, 1 / 12) - 1
  const realMonthly = (1 + nominalMonthly) / (1 + inflationMonthly) - 1

  const superNomMonthly = inputs.superGrowthRate != null
    ? Math.pow(1 + inputs.superGrowthRate / 100, 1 / 12) - 1
    : nominalMonthly
  const superRealMonthly = (1 + superNomMonthly) / (1 + inflationMonthly) - 1

  const sorted = [...lumpSums].sort((a, b) => a.atMonth - b.atMonth)
  const lastInheritanceMonth = sorted[sorted.length - 1].atMonth
  const maxMonths = Math.max(600, lastInheritanceMonth + 120)

  // ── Natural FIRE month (no inheritance) ────────────────────────────────────
  let naturalFireMonth: number | null = null
  {
    let investFV = currentNetWorth
    let superFV = superBal
    for (let m = 1; m <= maxMonths; m++) {
      investFV = investFV * (1 + realMonthly) + inputs.monthlySavings
      superFV = superFV * (1 + superRealMonthly)
      if (investFV + superFV >= fireNumber) { naturalFireMonth = m; break }
    }
  }

  // ── FIRE month WITH inheritance ────────────────────────────────────────────
  let fireWithInheritanceMonth: number | null = null
  let portfolioAtInheritance: number | null = null
  let combinedAtInheritance: number | null = null
  let shortfallAtInheritance: number | null = null

  {
    let investFV = currentNetWorth
    let superFV = superBal
    let inheritanceApplied = false

    for (let m = 1; m <= maxMonths; m++) {
      investFV = investFV * (1 + realMonthly) + inputs.monthlySavings
      superFV = superFV * (1 + superRealMonthly)

      // Apply any inheritances arriving this month
      for (const ls of sorted) {
        if (ls.atMonth === m) {
          if (!inheritanceApplied) portfolioAtInheritance = Math.round(investFV + superFV)
          investFV += ls.amount
          inheritanceApplied = true
          if (!combinedAtInheritance || m <= sorted[0].atMonth) {
            combinedAtInheritance = Math.round(investFV + superFV)
          }
        }
      }

      if (investFV + superFV >= fireNumber) {
        fireWithInheritanceMonth = m
        break
      }
    }

    // If we reached all inheritances but haven't hit FIRE yet, capture the shortfall
    if (portfolioAtInheritance !== null && combinedAtInheritance !== null && fireWithInheritanceMonth === null) {
      shortfallAtInheritance = Math.round(Math.max(0, fireNumber - combinedAtInheritance))
    }
  }

  const monthsEarlier = naturalFireMonth !== null && fireWithInheritanceMonth !== null
    ? naturalFireMonth - fireWithInheritanceMonth
    : 0

  return {
    fireWithInheritanceMonth,
    naturalFireMonth,
    monthsEarlier,
    portfolioAtInheritance,
    combinedAtInheritance,
    shortfallAtInheritance,
    accelerates: monthsEarlier > 0,
  }
}

export function computeFireProjection(
  currentNetWorth: number,  // investable assets EXCLUDING super (if superBalance provided)
  inputs: FireInputs
): FireResult {
  const fireNumber = inputs.annualExpenses / (inputs.withdrawalRate / 100)

  // Real return: strip out inflation so we work in today's dollars
  const nominalMonthly = Math.pow(1 + inputs.expectedReturn / 100, 1 / 12) - 1
  const inflationMonthly = Math.pow(1 + inputs.inflationRate / 100, 1 / 12) - 1
  const realMonthly = (1 + nominalMonthly) / (1 + inflationMonthly) - 1
  const realAnnual = Math.pow(1 + realMonthly, 12) - 1

  // Super grows at its own rate (contributions + investment returns combined)
  const superNomMonthly = inputs.superGrowthRate != null
    ? Math.pow(1 + inputs.superGrowthRate / 100, 1 / 12) - 1
    : nominalMonthly
  const superRealMonthly = (1 + superNomMonthly) / (1 + inflationMonthly) - 1
  const superBal = inputs.superBalance ?? 0

  let monthsToFire: number | null = null
  let projectedFireDate: Date | null = null
  let projectedFireAge: number | null = null

  const lumpSums = inputs.lumpSums ?? []

  function applyLumpSums(fv: number, month: number): number {
    for (const ls of lumpSums) {
      if (ls.atMonth === month) fv += ls.amount
    }
    return fv
  }

  const totalNW = currentNetWorth + superBal
  if (totalNW >= fireNumber) {
    monthsToFire = 0
    projectedFireDate = new Date()
    projectedFireAge = inputs.currentAge
  } else if (inputs.monthlySavings > 0 || realMonthly > 0 || lumpSums.length > 0) {
    let n = 0
    let investFV = currentNetWorth
    let superFV = superBal
    const maxMonths = 600 // 50 years max
    while (investFV + superFV < fireNumber && n < maxMonths) {
      investFV = investFV * (1 + realMonthly) + inputs.monthlySavings
      superFV = superFV * (1 + superRealMonthly)
      n++
      investFV = applyLumpSums(investFV, n)
    }
    if (investFV + superFV >= fireNumber) {
      monthsToFire = n
      const fireDate = new Date()
      fireDate.setMonth(fireDate.getMonth() + n)
      projectedFireDate = fireDate
      projectedFireAge = inputs.currentAge + n / 12
    }
  }

  // What will NW be at targetRetireAge?
  let valueAtTargetAge: number | null = null
  let shortfallAtTargetAge: number | null = null
  if (inputs.targetRetireAge != null) {
    const monthsToTarget = Math.max(0, (inputs.targetRetireAge - inputs.currentAge) * 12)
    let investFV = currentNetWorth
    let superFV = superBal
    for (let i = 1; i <= monthsToTarget; i++) {
      investFV = investFV * (1 + realMonthly) + inputs.monthlySavings
      superFV = superFV * (1 + superRealMonthly)
      investFV = applyLumpSums(investFV, i)
    }
    valueAtTargetAge = investFV + superFV
    shortfallAtTargetAge = valueAtTargetAge >= fireNumber ? 0 : fireNumber - valueAtTargetAge
  }

  return {
    fireNumber,
    realReturn: realAnnual * 100,
    monthsToFire,
    projectedFireDate,
    projectedFireAge,
    valueAtTargetAge,
    shortfallAtTargetAge,
  }
}

/** Generate monthly NW projection data points for a chart (real dollars). */
export function generateProjectionSeries(
  currentNetWorth: number,  // investable assets EXCLUDING super (if superBalance provided)
  fireNumber: number,
  inputs: FireInputs,
  months = 360
): { month: number; value: number; withoutContributions: number }[] {
  const nominalMonthly = Math.pow(1 + inputs.expectedReturn / 100, 1 / 12) - 1
  const inflationMonthly = Math.pow(1 + inputs.inflationRate / 100, 1 / 12) - 1
  const realMonthly = (1 + nominalMonthly) / (1 + inflationMonthly) - 1

  const superNomMonthly = inputs.superGrowthRate != null
    ? Math.pow(1 + inputs.superGrowthRate / 100, 1 / 12) - 1
    : nominalMonthly
  const superRealMonthly = (1 + superNomMonthly) / (1 + inflationMonthly) - 1
  const superBal = inputs.superBalance ?? 0

  const lumpSums = inputs.lumpSums ?? []
  const points: { month: number; value: number; withoutContributions: number }[] = []
  let investFV = currentNetWorth
  let superFV = superBal
  let investFVNoContrib = currentNetWorth
  let superFVNoContrib = superBal

  let fireMonth = months
  for (let m = 0; m <= months; m++) {
    const fv = investFV + superFV
    const fvNoContrib = investFVNoContrib + superFVNoContrib
    if (fv >= fireNumber && fireMonth === months) fireMonth = m + 12
    points.push({ month: m, value: Math.round(fv), withoutContributions: Math.round(fvNoContrib) })
    if (m > fireMonth) break
    investFV = investFV * (1 + realMonthly) + inputs.monthlySavings
    superFV = superFV * (1 + superRealMonthly)
    investFVNoContrib = investFVNoContrib * (1 + realMonthly)
    superFVNoContrib = superFVNoContrib * (1 + superRealMonthly)
    // Apply lump sums at this month
    for (const ls of lumpSums) {
      if (ls.atMonth === m + 1) {
        investFV += ls.amount
        investFVNoContrib += ls.amount
      }
    }
  }

  return points
}
