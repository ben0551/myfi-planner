import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const portfolioId = searchParams.get('portfolioId')
  const triggered = searchParams.get('triggered')
  const since = searchParams.get('since')

  const where: Record<string, unknown> = { userId: session.user.id }
  if (portfolioId) where.portfolioId = portfolioId
  if (triggered === 'true') where.isTriggered = true
  if (triggered === 'false') where.isTriggered = false
  if (since) where.triggeredAt = { gte: new Date(since) }

  const alerts = await prisma.priceAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { portfolio: { select: { name: true } } },
  })
  return Response.json(alerts)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { ticker, targetPrice, direction, note, portfolioId } = body

  if (!ticker || targetPrice === undefined || !direction) {
    return Response.json(
      { error: 'ticker, targetPrice, and direction are required' },
      { status: 400 }
    )
  }
  if (!['ABOVE', 'BELOW'].includes(direction.toUpperCase())) {
    return Response.json(
      { error: 'direction must be ABOVE or BELOW' },
      { status: 400 }
    )
  }

  const alert = await prisma.priceAlert.create({
    data: {
      ticker: ticker.toUpperCase(),
      targetPrice: parseFloat(targetPrice),
      direction: direction.toUpperCase(),
      note: note ?? null,
      portfolioId: portfolioId ?? null,
      userId: session.user.id,
    },
  })
  return Response.json(alert, { status: 201 })
}
