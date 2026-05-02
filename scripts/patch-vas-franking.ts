import { PrismaClient } from '@prisma/client'

// Exact data from MarketIndex VAS dividend history (DD/MM/YYYY → frankingPct)
const VAS_FRANKING: { exDate: string; frankingPct: number }[] = [
  { exDate: '2026-04-01', frankingPct: 82 },
  { exDate: '2026-01-02', frankingPct: 68 },
  { exDate: '2025-10-01', frankingPct: 83 },
  { exDate: '2025-07-01', frankingPct: 62 },
  { exDate: '2025-04-01', frankingPct: 79 },
  { exDate: '2025-01-02', frankingPct: 72 },
  { exDate: '2024-10-01', frankingPct: 71 },
  { exDate: '2024-07-01', frankingPct: 57 },
  { exDate: '2024-04-02', frankingPct: 78 },
  { exDate: '2024-01-02', frankingPct: 74 },
  { exDate: '2023-10-02', frankingPct: 87 },
  { exDate: '2023-07-03', frankingPct: 82 },
  { exDate: '2023-04-03', frankingPct: 87 },
  { exDate: '2023-01-03', frankingPct: 82 },
  { exDate: '2022-10-03', frankingPct: 89 },
  { exDate: '2022-07-01', frankingPct: 66 },
  { exDate: '2022-04-01', frankingPct: 42 },
  { exDate: '2022-01-04', frankingPct: 63 },
  { exDate: '2021-10-01', frankingPct: 87 },
  { exDate: '2021-07-01', frankingPct: 50 },
]

async function main() {
  const db = new PrismaClient()

  const vasTxs = await db.transaction.findMany({
    where: { ticker: 'VAS', type: { in: ['DIVIDEND', 'DRP'] } },
    select: { id: true, date: true, frankingPct: true },
  })

  console.log(`Found ${vasTxs.length} VAS dividend transactions`)
  let updated = 0

  for (const tx of vasTxs) {
    const txTs = new Date(tx.date).getTime()
    const match = VAS_FRANKING.find(
      (r) => Math.abs(new Date(r.exDate).getTime() - txTs) <= 5 * 86400 * 1000
    )
    if (match) {
      await db.transaction.update({
        where: { id: tx.id },
        data: { frankingPct: match.frankingPct },
      })
      console.log(`  VAS ${new Date(tx.date).toISOString().split('T')[0]} → ${match.frankingPct}% (was ${tx.frankingPct}%)`)
      updated++
    } else {
      console.log(`  VAS ${new Date(tx.date).toISOString().split('T')[0]} — no match`)
    }
  }

  console.log(`\nUpdated ${updated}/${vasTxs.length}`)
  await db.$disconnect()
}

main().catch(console.error)
