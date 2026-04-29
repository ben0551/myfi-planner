import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.watchlistItem.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const item = await prisma.watchlistItem.update({
    where: { id },
    data: {
      targetPrice: body.targetPrice ?? null,
      notes: body.notes ?? null,
    },
  })

  return Response.json(item)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.watchlistItem.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.watchlistItem.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
