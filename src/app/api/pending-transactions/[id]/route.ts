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
  const { action, portfolioId, cashAccountId, overrides } = body

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
    const quantity = Number(overrides?.quantity ?? pending.quantity ?? 0)
    const price = Number(overrides?.price ?? pending.price ?? 0)
    const fees = Number(overrides?.fees ?? pending.fees ?? 0)
    // For DIVIDEND: amount = total income = shares held × per-share amount
    const totalAmount = type === 'DIVIDEND' ? quantity * price : null

    // Franking: prefer explicit override, fall back to parseWarnings
    const frankingFromWarnings = pending.parseWarnings?.match(/Franking:\s*(\d+)/)
    const frankingPct = overrides?.frankingPct != null
      ? Number(overrides.frankingPct)
      : frankingFromWarnings ? parseInt(frankingFromWarnings[1], 10) : 0

    if (!type || !ticker || !date) {
      return Response.json(
        { error: 'transactionType, ticker, and tradeDate are required' },
        { status: 400 }
      )
    }

    const txDate = new Date(date)

    const tx = await prisma.$transaction(async (db) => {
      const created = await db.transaction.create({
        data: {
          portfolioId: pid,
          type: type.toUpperCase() as 'BUY' | 'SELL' | 'DIVIDEND' | 'DRP',
          ticker: ticker.toUpperCase(),
          date: txDate,
          quantity,
          price: type === 'DIVIDEND' ? 0 : price,
          fees,
          amount: totalAmount,
          frankingPct,
          notes: overrides?.notes ?? null,
        },
      })

      // Optionally credit dividend proceeds to a cash account
      if (cashAccountId && totalAmount && totalAmount > 0) {
        const account = await db.cashAccount.findUnique({ where: { id: cashAccountId } })
        if (account && (isAdmin || account.userId === session.user.id)) {
          const newBalance = account.balance + totalAmount
          await db.cashAccount.update({
            where: { id: cashAccountId },
            data: { balance: newBalance, balanceUpdatedAt: txDate },
          })
          await db.cashBalanceHistory.upsert({
            where: { accountId_date: { accountId: cashAccountId, date: txDate } },
            update: { balance: newBalance },
            create: { accountId: cashAccountId, balance: newBalance, date: txDate },
          })
        }
      }

      await db.pendingTransaction.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          portfolioId: pid,
          transactionId: created.id,
        },
      })

      return created
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
