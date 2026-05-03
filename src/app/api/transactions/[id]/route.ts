import { NextRequest } from 'next/server'
import { prisma, prismaRaw } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getOwnedTransaction(id: string, userId: string, includeDeleted = false) {
  // Use prismaRaw when we may need to see deleted rows (for restore flow).
  const client = includeDeleted ? prismaRaw : prisma
  const tx = await client.transaction.findUnique({
    where: { id },
    include: { portfolio: { select: { userId: true } } },
  })
  if (!tx || tx.portfolio.userId !== userId) return null
  if (!includeDeleted && tx.deletedAt) return null
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
  const { type, ticker, date, quantity, price, fees, amount, frankingPct, frankingCredit, notes } = body
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
      frankingCredit: frankingCredit ?? undefined,
      notes: notes ?? null,
    },
  })
  return Response.json(tx)
}

/**
 * Soft-delete by default. Pass ?hard=true to permanently remove.
 * Soft-deleted rows are excluded from all reads via the deletedAt filter
 * but can be restored via POST { restore: true }.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(request.url)
  const hard = url.searchParams.get('hard') === 'true'

  const owned = await getOwnedTransaction(id, session.user.id, /* includeDeleted */ hard)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  if (hard) {
    await prismaRaw.transaction.delete({ where: { id } })
  } else {
    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
  return new Response(null, { status: 204 })
}

/** POST { restore: true } — undoes a soft-delete. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  if (body?.restore !== true) {
    return Response.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const owned = await getOwnedTransaction(id, session.user.id, /* includeDeleted */ true)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!owned.deletedAt) {
    return Response.json({ error: 'Not deleted' }, { status: 400 })
  }

  const tx = await prismaRaw.transaction.update({
    where: { id },
    data: { deletedAt: null },
  })
  return Response.json(tx)
}
