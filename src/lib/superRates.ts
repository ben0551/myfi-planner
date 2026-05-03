/**
 * Australian Super Guarantee (SG) rate schedule.
 * Rates are legislated by FY ending year.
 *
 * Reference: Australian Tax Office (legislated through to FY2025-26 = 12%).
 */

interface SgEntry {
  fyEndYear: number  // FY ending year (FY2024-25 → 2025)
  ratePct: number
}

const SCHEDULE: SgEntry[] = [
  { fyEndYear: 2022, ratePct: 10.0 },
  { fyEndYear: 2023, ratePct: 10.5 },
  { fyEndYear: 2024, ratePct: 11.0 },
  { fyEndYear: 2025, ratePct: 11.5 },
  { fyEndYear: 2026, ratePct: 12.0 },
  // Legislated maximum — no further indexation scheduled.
]

const DEFAULT_RATE = SCHEDULE.at(-1)!.ratePct

/** Australian FY runs July 1 → June 30. FY2025-26 ends 2026. */
export function fyEndYear(d: Date): number {
  return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear()
}

/** Returns the legislated SG rate for the given FY end year. */
export function sgRateForFy(year: number): number {
  // Find latest entry at or before the requested year
  const match = [...SCHEDULE].reverse().find((e) => e.fyEndYear <= year)
  if (match) return match.ratePct
  // Year predates the schedule — fall back to earliest known rate
  return SCHEDULE[0].ratePct
}

/** SG rate applicable today. */
export function currentSgRate(now: Date = new Date()): number {
  const fy = fyEndYear(now)
  // For future FYs beyond the legislated schedule, return the latest known rate
  if (fy > SCHEDULE.at(-1)!.fyEndYear) return DEFAULT_RATE
  return sgRateForFy(fy)
}
