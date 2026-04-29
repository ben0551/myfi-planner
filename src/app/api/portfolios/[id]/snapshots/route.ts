import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'asc' },
  })

  return Response.json(
    snapshots.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      value: s.value,
      invested: s.invested,
    }))
  )
}
