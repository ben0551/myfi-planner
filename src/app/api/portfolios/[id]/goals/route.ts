import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function ownsPortfolio(portfolioId: string, userId: string) {
  const p = await prisma.portfolio.findUnique({ where: { id: portfolioId, userId }, select: { id: true } })
  return p != null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!await ownsPortfolio(id, session.user.id)) return Response.json({ error: 'Not found' }, { status: 404 })

  const goals = await prisma.goal.findMany({ where: { portfolioId: id }, orderBy: { createdAt: 'asc' } })
  return Response.json(goals)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!await ownsPortfolio(id, session.user.id)) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const goal = await prisma.goal.create({
    data: {
      portfolioId: id,
      name: body.name,
      type: body.type ?? 'VALUE',
      targetValue: body.targetValue,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      notes: body.notes ?? null,
    },
  })
  return Response.json(goal, { status: 201 })
}
