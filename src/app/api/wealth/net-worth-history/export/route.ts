import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toCsv, csvResponse } from '@/lib/csv'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const snapshots = await prisma.netWorthSnapshot.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'asc' },
  })

  const csv = toCsv(
    ['Date', 'Net Worth', 'Total Assets', 'Total Liabilities', 'Shares', 'Term Deposits', 'Property', 'Super', 'Cash'],
    snapshots.map((s) => [
      s.date.toISOString().split('T')[0],
      s.netWorth.toFixed(2),
      s.totalAssets.toFixed(2),
      s.totalLiabilities.toFixed(2),
      s.sharesValue.toFixed(2),
      s.tdValue.toFixed(2),
      s.propertyValue.toFixed(2),
      s.superBalance.toFixed(2),
      s.cashBalance.toFixed(2),
    ]),
  )

  const today = new Date().toISOString().split('T')[0]
  return csvResponse(csv, `net_worth_history_${today}.csv`)
}
