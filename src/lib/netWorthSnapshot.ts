import { prisma } from './prisma'

export async function recordNetWorthSnapshot(
  userId: string,
  data: {
    totalAssets: number
    totalLiabilities: number
    netWorth: number
    sharesValue: number
    propertyValue: number
    superBalance: number
    cashBalance: number
  }
): Promise<void> {
  if (data.totalAssets === 0 && data.totalLiabilities === 0) return

  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  try {
    await prisma.netWorthSnapshot.upsert({
      where: { userId_date: { userId, date } },
      update: data,
      create: { userId, date, ...data },
    })
  } catch (err) {
    console.error('[networth] recordNetWorthSnapshot failed:', err)
  }
}
