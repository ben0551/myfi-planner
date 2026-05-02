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
  const {
    name, description, currency = 'AUD',
    portfolioType = 'SHARES',
    tdPrincipal, tdRate, tdTermMonths, tdStartDate, tdInterestFreq,
  } = body
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 })
  }

  let tdMaturityDate: Date | undefined
  if (portfolioType === 'TERM_DEPOSIT' && tdStartDate && tdTermMonths) {
    const start = new Date(tdStartDate)
    start.setMonth(start.getMonth() + Number(tdTermMonths))
    tdMaturityDate = start
  }

  const portfolio = await prisma.portfolio.create({
    data: {
      name, description, currency, userId: session.user.id,
      portfolioType,
      ...(portfolioType === 'TERM_DEPOSIT' ? {
        tdPrincipal: tdPrincipal ? Number(tdPrincipal) : null,
        tdRate:      tdRate      ? Number(tdRate)      : null,
        tdTermMonths: tdTermMonths ? Number(tdTermMonths) : null,
        tdStartDate:   tdStartDate   ? new Date(tdStartDate) : null,
        tdMaturityDate: tdMaturityDate ?? null,
        tdInterestFreq: tdInterestFreq ?? 'AT_MATURITY',
      } : {}),
    },
  })
  return Response.json(portfolio, { status: 201 })
}
