import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin()
  if (denied) return denied

  const session = await auth()
  const { id } = await params
  const body = await request.json()
  const { status, role } = body

  // Prevent admin from demoting/disabling themselves
  if (id === session!.user.id && (status === 'DISABLED' || role === 'USER')) {
    return Response.json({ error: 'Cannot demote or disable your own account' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
    },
    select: { id: true, email: true, name: true, role: true, status: true },
  })
  return Response.json(user)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin()
  if (denied) return denied

  const session = await auth()
  const { id } = await params

  if (id === session!.user.id) {
    return Response.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  await prisma.user.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
