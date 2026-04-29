import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — fetch current user's household (if any)
export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    include: {
      household: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { joinedAt: 'asc' },
          },
        },
      },
    },
  })

  return Response.json(membership ?? null)
}

// POST — create a new household (caller becomes OWNER)
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Check not already in a household
  const existing = await prisma.householdMember.findFirst({ where: { userId: session.user.id } })
  if (existing) return Response.json({ error: 'Already in a household — leave first' }, { status: 409 })

  const { name } = await request.json() as { name?: string }

  const household = await prisma.household.create({
    data: {
      name: name?.trim() || 'Family',
      members: { create: { userId: session.user.id, role: 'OWNER' } },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  })

  return Response.json(household, { status: 201 })
}

// PATCH — rename household (OWNER only)
export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await prisma.householdMember.findFirst({ where: { userId: session.user.id } })
  if (!membership || membership.role !== 'OWNER')
    return Response.json({ error: 'Not the household owner' }, { status: 403 })

  const { name } = await request.json() as { name?: string }
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

  const updated = await prisma.household.update({
    where: { id: membership.householdId },
    data: { name: name.trim() },
  })

  return Response.json(updated)
}

// DELETE — leave (or dissolve if OWNER)
export async function DELETE() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await prisma.householdMember.findFirst({ where: { userId: session.user.id } })
  if (!membership) return Response.json({ error: 'Not in a household' }, { status: 404 })

  if (membership.role === 'OWNER') {
    // Dissolve entire household
    await prisma.household.delete({ where: { id: membership.householdId } })
  } else {
    await prisma.householdMember.delete({ where: { id: membership.id } })
  }

  return Response.json({ ok: true })
}
