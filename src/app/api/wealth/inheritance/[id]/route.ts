import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.anticipatedInheritance.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const { name, amount, expectedYear, probability, currency, notes, includeInFire } = body

  const updated = await prisma.anticipatedInheritance.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(expectedYear !== undefined && { expectedYear: parseInt(expectedYear) }),
      ...(probability !== undefined && { probability: parseInt(probability) }),
      ...(currency !== undefined && { currency }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(includeInFire !== undefined && { includeInFire }),
    },
  })
  return Response.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.anticipatedInheritance.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.anticipatedInheritance.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
