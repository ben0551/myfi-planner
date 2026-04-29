import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getOwnedTransaction(id: string, userId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: { portfolio: { select: { userId: true } } },
  })
  if (!tx || tx.portfolio.userId !== userId) return null
  return tx
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const tx = await getOwnedTransaction(id, session.user.id)
  if (!tx) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(tx)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedTransaction(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { type, ticker, date, quantity, price, fees, amount, frankingPct, notes } = body
  const tx = await prisma.transaction.update({
    where: { id },
    data: {
      type: type?.toUpperCase(),
      ticker: ticker?.toUpperCase(),
      date: date ? new Date(date) : undefined,
      quantity,
      price,
      fees,
      amount: amount ?? null,
      frankingPct: frankingPct ?? undefined,
      notes: notes ?? null,
    },
  })
  return Response.json(tx)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedTransaction(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.transaction.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
