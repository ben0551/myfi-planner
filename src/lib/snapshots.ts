import { prisma } from './prisma'

/**
 * Records today's portfolio value as a snapshot.
 * Upserts so it's safe to call on every page load.
 * Skips if marketValue is 0 (prices unavailable).
 */
export async function recordSnapshot(
  portfolioId: string,
  marketValue: number,
  invested: number
): Promise<void> {
  if (marketValue <= 0) return

  // Truncate to midnight UTC so one record per calendar day
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  try {
    await prisma.portfolioSnapshot.upsert({
      where: { portfolioId_date: { portfolioId, date } },
      update: { value: marketValue, invested },
      create: { portfolioId, date, value: marketValue, invested },
    })
  } catch (err) {
    // Non-fatal — snapshot failure shouldn't break the page
    console.error('[snapshots] recordSnapshot failed:', err)
  }
}
