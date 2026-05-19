import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getOwnedPortfolio(id: string, userId: string) {
  const portfolio = await prisma.portfolio.findUnique({ where: { id } })
  if (!portfolio) return null
  if (portfolio.userId !== userId) return null
  return portfolio
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
    include: { _count: { select: { transactions: true } } },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(portfolio)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedPortfolio(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const {
    name, description, currency,
    tdPrincipal, tdRate, tdTermMonths, tdStartDate, tdMaturityDate: tdMaturityDateRaw, tdInterestFreq,
  } = body

  let tdMaturityDate: Date | undefined
  if (owned.portfolioType === 'TERM_DEPOSIT') {
    if (tdMaturityDateRaw) {
      // Direct end date provided
      tdMaturityDate = new Date(tdMaturityDateRaw)
    } else if (tdStartDate && tdTermMonths) {
      // Derive from start + term
      const start = new Date(tdStartDate)
      start.setMonth(start.getMonth() + Number(tdTermMonths))
      tdMaturityDate = start
    }
  }

  // Recalculate term months from dates when end date is set directly
  let resolvedTermMonths: number | undefined
  if (owned.portfolioType === 'TERM_DEPOSIT' && tdStartDate && tdMaturityDate) {
    const start = new Date(tdStartDate)
    const ms = tdMaturityDate.getTime() - start.getTime()
    resolvedTermMonths = Math.round(ms / (1000 * 60 * 60 * 24 * 30.44))
  } else if (tdTermMonths != null) {
    resolvedTermMonths = Number(tdTermMonths)
  }

  const portfolio = await prisma.portfolio.update({
    where: { id },
    data: {
      name, description, currency,
      ...(owned.portfolioType === 'TERM_DEPOSIT' ? {
        tdPrincipal:    tdPrincipal    != null ? Number(tdPrincipal)    : undefined,
        tdRate:         tdRate         != null ? Number(tdRate)         : undefined,
        tdTermMonths:   resolvedTermMonths                              ?? undefined,
        tdStartDate:    tdStartDate    ? new Date(tdStartDate)          : undefined,
        tdMaturityDate: tdMaturityDate                                  ?? undefined,
        tdInterestFreq: tdInterestFreq                                  ?? undefined,
      } : {}),
    },
  })
  return Response.json(portfolio)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedPortfolio(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.portfolio.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
