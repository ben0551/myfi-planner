/**
 * Multi-currency conversion. ECB publishes daily EUR-base rates;
 * cross-currency conversion goes via EUR.
 *
 * Usage:
 *   const aud = await convertTo(usdAmount, 'USD', 'AUD')
 *   const aud = await convertTo(usdAmount, 'USD', 'AUD', myDate)  // historical
 *
 * Display sites can call this once at render to normalize a mix of
 * holdings into a single display currency.
 */

import { prisma } from './prisma'

const ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

/** Identity short-circuit. */
function isSame(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase()
}

function dayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Look up the rate from base EUR to a target currency on or before `date`.
 * Returns null if no rate is cached and no fallback is found.
 */
async function getEurRate(toCcy: string, date: Date): Promise<number | null> {
  if (toCcy.toUpperCase() === 'EUR') return 1
  const row = await prisma.fxRate.findFirst({
    where: {
      fromCcy: 'EUR',
      toCcy: toCcy.toUpperCase(),
      date: { lte: dayUtc(date) },
    },
    orderBy: { date: 'desc' },
  })
  return row?.rate ?? null
}

/**
 * Convert `amount` from `fromCcy` to `toCcy`. If `date` is provided, uses
 * the rate at or before that date; otherwise uses the latest cached rate.
 *
 * Returns the original `amount` (unchanged) if conversion isn't possible
 * (no rates cached yet) — callers should treat the result as "best effort".
 */
export async function convertTo(
  amount: number,
  fromCcy: string,
  toCcy: string,
  date: Date = new Date(),
): Promise<number> {
  if (isSame(fromCcy, toCcy) || amount === 0) return amount
  const fromEur = await getEurRate(fromCcy, date)
  const toEur = await getEurRate(toCcy, date)
  if (!fromEur || !toEur) return amount // no rate → return unchanged
  // amount in fromCcy → EUR → toCcy
  const inEur = amount / fromEur
  return inEur * toEur
}

/** Synchronous variant when you already have a rate map keyed by ccy. */
export function convertWithMap(
  amount: number,
  fromCcy: string,
  toCcy: string,
  eurRates: Map<string, number>,
): number {
  if (isSame(fromCcy, toCcy) || amount === 0) return amount
  const fromEur = fromCcy.toUpperCase() === 'EUR' ? 1 : eurRates.get(fromCcy.toUpperCase())
  const toEur = toCcy.toUpperCase() === 'EUR' ? 1 : eurRates.get(toCcy.toUpperCase())
  if (!fromEur || !toEur) return amount
  return (amount / fromEur) * toEur
}

/** Returns the latest cached EUR-base rates as a map (ccy → rate). */
export async function getLatestEurRates(asOf: Date = new Date()): Promise<Map<string, number>> {
  const rows = await prisma.fxRate.findMany({
    where: { fromCcy: 'EUR', date: { lte: dayUtc(asOf) } },
    orderBy: { date: 'desc' },
    distinct: ['toCcy'],
    select: { toCcy: true, rate: true },
  })
  const map = new Map<string, number>()
  for (const r of rows) map.set(r.toCcy.toUpperCase(), r.rate)
  return map
}

/**
 * Fetch the latest daily rates from ECB and upsert them. Idempotent —
 * safe to call multiple times per day. Returns the number of currencies updated.
 */
export async function refreshEcbRates(): Promise<{ date: string; count: number } | { error: string }> {
  let xml: string
  try {
    const res = await fetch(ECB_DAILY_URL, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return { error: `ECB returned ${res.status}` }
    xml = await res.text()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'fetch failed' }
  }

  // Naive XML parse — pulls out <Cube time="..."> and <Cube currency="..." rate="..."/>
  const dateMatch = xml.match(/<Cube time="([0-9-]+)"/)
  if (!dateMatch) return { error: 'Could not parse ECB date' }
  const date = dayUtc(new Date(dateMatch[1] + 'T00:00:00Z'))

  const rateRe = /<Cube currency="([A-Z]{3})" rate="([0-9.]+)"\s*\/>/g
  const entries: { ccy: string; rate: number }[] = []
  let m: RegExpExecArray | null
  while ((m = rateRe.exec(xml)) !== null) {
    entries.push({ ccy: m[1], rate: parseFloat(m[2]) })
  }
  if (entries.length === 0) return { error: 'No rates parsed from ECB feed' }

  for (const e of entries) {
    await prisma.fxRate.upsert({
      where: {
        date_fromCcy_toCcy: { date, fromCcy: 'EUR', toCcy: e.ccy },
      },
      update: { rate: e.rate, fetchedAt: new Date() },
      create: { date, fromCcy: 'EUR', toCcy: e.ccy, rate: e.rate, source: 'ECB' },
    })
  }

  return { date: date.toISOString().split('T')[0], count: entries.length }
}
