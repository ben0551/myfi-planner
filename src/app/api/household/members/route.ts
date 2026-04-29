import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE — owner removes a member by userId
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await request.json() as { userId?: string }
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })
  if (userId === session.user.id) return Response.json({ error: 'Use /api/household to leave' }, { status: 400 })

  const ownerMembership = await prisma.householdMember.findFirst({ where: { userId: session.user.id, role: 'OWNER' } })
  if (!ownerMembership) return Response.json({ error: 'Not the household owner' }, { status: 403 })

  const target = await prisma.householdMember.findFirst({
    where: { householdId: ownerMembership.householdId, userId },
  })
  if (!target) return Response.json({ error: 'Member not found' }, { status: 404 })

  await prisma.householdMember.delete({ where: { id: target.id } })
  return Response.json({ ok: true })
}
