import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST — join a household with an invite code
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { inviteCode } = await request.json() as { inviteCode?: string }
  if (!inviteCode?.trim()) return Response.json({ error: 'Invite code required' }, { status: 400 })

  const existing = await prisma.householdMember.findFirst({ where: { userId: session.user.id } })
  if (existing) return Response.json({ error: 'Already in a household — leave first' }, { status: 409 })

  const household = await prisma.household.findUnique({
    where: { inviteCode: inviteCode.trim() },
    include: { members: true },
  })

  if (!household) return Response.json({ error: 'Invalid invite code' }, { status: 404 })

  // Prevent duplicate membership
  const alreadyMember = household.members.some((m) => m.userId === session.user.id)
  if (alreadyMember) return Response.json({ error: 'Already a member' }, { status: 409 })

  await prisma.householdMember.create({
    data: { householdId: household.id, userId: session.user.id, role: 'MEMBER' },
  })

  return Response.json({ ok: true, householdName: household.name })
}
