import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { transactions: true } } },
  })
  return Response.json(portfolios)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, description, currency = 'AUD' } = body
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 })
  }
  const portfolio = await prisma.portfolio.create({
    data: { name, description, currency, userId: session.user.id },
  })
  return Response.json(portfolio, { status: 201 })
}
