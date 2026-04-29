import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.priceAlert.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const { targetPrice, direction, note, isTriggered } = body

  const alert = await prisma.priceAlert.update({
    where: { id },
    data: {
      targetPrice: targetPrice !== undefined ? parseFloat(targetPrice) : undefined,
      direction: direction?.toUpperCase(),
      note: note ?? undefined,
      isTriggered: isTriggered !== undefined ? Boolean(isTriggered) : undefined,
      triggeredAt: isTriggered === false ? null : undefined,
      triggeredPrice: isTriggered === false ? null : undefined,
    },
  })
  return Response.json(alert)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.priceAlert.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.priceAlert.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
