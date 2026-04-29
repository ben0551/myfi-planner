import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeTaxSummary, availableFYs, currentFY } from '@/lib/tax'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  const fyParam = request.nextUrl.searchParams.get('fy')
  const fyYear = fyParam ? parseInt(fyParam, 10) : currentFY()

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'asc' },
  })

  const summary = computeTaxSummary(transactions, fyYear)

  return Response.json({
    ...summary,
    availableFYs: availableFYs(transactions),
  })
}
