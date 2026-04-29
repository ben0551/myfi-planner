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
  const body = await request.json()
  const { action, portfolioId, overrides } = body

  const pending = await prisma.pendingTransaction.findUnique({ where: { id } })
  if (!pending) return Response.json({ error: 'Not found' }, { status: 404 })

  // Users can only access their own; admins can access all (including unowned SMTP)
  const isAdmin = session.user.role === 'ADMIN'
  if (!isAdmin && pending.userId !== session.user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (action === 'confirm') {
    const pid = portfolioId ?? pending.portfolioId
    if (!pid) {
      return Response.json({ error: 'portfolioId required to confirm' }, { status: 400 })
    }

    // Verify the target portfolio belongs to the acting user (or admin)
    if (!isAdmin) {
      const portfolio = await prisma.portfolio.findUnique({ where: { id: pid } })
      if (!portfolio || portfolio.userId !== session.user.id) {
        return Response.json({ error: 'Portfolio not found' }, { status: 404 })
      }
    }

    const type = (overrides?.transactionType ?? pending.transactionType) as string
    const ticker = (overrides?.ticker ?? pending.ticker) as string
    const date = overrides?.tradeDate ?? pending.tradeDate
    const quantity = overrides?.quantity ?? pending.quantity ?? 0
    const price = overrides?.price ?? pending.price ?? 0
    const fees = overrides?.fees ?? pending.fees ?? 0
    const amount = type === 'DIVIDEND' ? price : null

    if (!type || !ticker || !date) {
      return Response.json(
        { error: 'transactionType, ticker, and tradeDate are required' },
        { status: 400 }
      )
    }

    const tx = await prisma.transaction.create({
      data: {
        portfolioId: pid,
        type: type.toUpperCase() as 'BUY' | 'SELL' | 'DIVIDEND',
        ticker: ticker.toUpperCase(),
        date: new Date(date),
        quantity,
        price: type === 'DIVIDEND' ? 0 : price,
        fees,
        amount: type === 'DIVIDEND' ? amount : null,
        notes: overrides?.notes ?? null,
      },
    })

    await prisma.pendingTransaction.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        portfolioId: pid,
        transactionId: tx.id,
      },
    })

    return Response.json({ status: 'confirmed', transaction: tx })
  }

  if (action === 'reject') {
    await prisma.pendingTransaction.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date() },
    })
    return Response.json({ status: 'rejected' })
  }

  // Update fields without confirming
  const { transactionType, ticker, quantity, price, fees, tradeDate, portfolioId: pid } = body
  const updated = await prisma.pendingTransaction.update({
    where: { id },
    data: {
      transactionType: transactionType ?? undefined,
      ticker: ticker?.toUpperCase() ?? undefined,
      quantity: quantity ?? undefined,
      price: price ?? undefined,
      fees: fees ?? undefined,
      tradeDate: tradeDate ? new Date(tradeDate) : undefined,
      portfolioId: pid ?? undefined,
    },
  })
  return Response.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const pending = await prisma.pendingTransaction.findUnique({ where: { id } })
  if (!pending) return Response.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = session.user.role === 'ADMIN'
  if (!isAdmin && pending.userId !== session.user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.pendingTransaction.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
