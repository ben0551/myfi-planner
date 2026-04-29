import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function ownsGoal(goalId: string, userId: string) {
  const g = await prisma.goal.findFirst({
    where: { id: goalId, portfolio: { userId } },
    select: { id: true },
  })
  return g != null
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; goalId: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { goalId } = await params
  if (!await ownsGoal(goalId, session.user.id)) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const goal = await prisma.goal.update({
    where: { id: goalId },
    data: {
      name: body.name,
      type: body.type,
      targetValue: body.targetValue,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      notes: body.notes ?? null,
    },
  })
  return Response.json(goal)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; goalId: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { goalId } = await params
  if (!await ownsGoal(goalId, session.user.id)) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.goal.delete({ where: { id: goalId } })
  return new Response(null, { status: 204 })
}
