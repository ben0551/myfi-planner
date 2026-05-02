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

    // Franking credit dollar amount — preferred over frankingPct
    const frankingCredit = overrides?.frankingCredit != null ? Number(overrides.frankingCredit) : 0
    // Legacy franking pct — only used as fallback when no credit $ amount provided
    const frankingFromWarnings = pending.parseWarnings?.match(/Franking:\s*(\d+)/)
    const frankingPct = frankingCredit > 0
      ? 0  // pct irrelevant when we have the dollar amount
      : overrides?.frankingPct != null
        ? Number(overrides.frankingPct)
        : frankingFromWarnings ? parseInt(frankingFromWarnings[1], 10) : 0

    if (!type || !ticker || !date) {
      return Response.json(
        { error: 'transactionType, ticker, and tradeDate are required' },
        { status: 400 }
      )
    }

    // Resolve quantity, price, and amount based on transaction type.
    // Pending items store: quantity = shares held at ex-date, price = dividend per share.
    let quantity: number
    let price: number
    let totalAmount: number | null

    if (type === 'DIVIDEND') {
      // amount = total cash income = shares_held × div_per_share
      quantity = Number(overrides?.quantity ?? pending.quantity ?? 0)
      const divPerShare = Number(overrides?.price ?? pending.price ?? 0)
      totalAmount = quantity * divPerShare
      price = 0  // DIVIDEND transactions don't store a per-share price
    } else if (type === 'DRP' && overrides?.quantity == null) {
      // DRP: derive new shares from total dividend ÷ DRP share price.
      // If caller passes drpSharePrice override, use it; otherwise fetch PriceCache.
      const totalDiv = Number(pending.quantity ?? 0) * Number(pending.price ?? 0)
      let drpSharePrice = overrides?.drpSharePrice ? Number(overrides.drpSharePrice) : null
      if (!drpSharePrice || drpSharePrice <= 0) {
        const pc = await prisma.priceCache.findUnique({
          where: { ticker: ticker.toUpperCase() },
          select: { price: true },
        })
        drpSharePrice = pc ? Number(pc.price) : null
      }
      if (!drpSharePrice || drpSharePrice <= 0) {
        return Response.json(
          { error: 'DRP share price is required — enter a price before confirming' },
          { status: 400 }
        )
      }
      if (totalDiv <= 0) {
        return Response.json({ error: 'Dividend amount is zero — cannot compute DRP shares' }, { status: 400 })
      }
      quantity = Math.round((totalDiv / drpSharePrice) * 10000) / 10000
      price = drpSharePrice
      totalAmount = totalDiv
    } else {
      quantity = Number(overrides?.quantity ?? pending.quantity ?? 0)
      price = Number(overrides?.price ?? pending.price ?? 0)
      totalAmount = null
    }

    const fees = Number(overrides?.fees ?? pending.fees ?? 0)
    const txDate = new Date(date)

    // Pre-validate cash account ownership before starting the transaction
    let cashAccount: { id: string; balance: number } | null = null
    if (cashAccountId && totalAmount && totalAmount > 0) {
      const acct = await prisma.cashAccount.findUnique({
        where: { id: cashAccountId },
        select: { id: true, balance: true, userId: true },
      })
      if (!acct || (!isAdmin && acct.userId !== session.user.id)) {
        return Response.json({ error: 'Cash account not found or access denied' }, { status: 400 })
      }
      cashAccount = { id: acct.id, balance: acct.balance }
    }

    const tx = await prisma.$transaction(async (db) => {
      const created = await db.transaction.create({
        data: {
          portfolioId: pid,
          type: type.toUpperCase() as 'BUY' | 'SELL' | 'DIVIDEND' | 'DRP',
          ticker: ticker.toUpperCase(),
          date: txDate,
          quantity,
          price,
          fees,
          amount: totalAmount,
          frankingPct,
          frankingCredit,
          notes: overrides?.notes ?? null,
        },
      })

      // Credit dividend proceeds to the pre-validated cash account
      if (cashAccount && totalAmount && totalAmount > 0) {
        const newBalance = cashAccount.balance + totalAmount
        await db.cashAccount.update({
          where: { id: cashAccount.id },
          data: { balance: newBalance, balanceUpdatedAt: txDate },
        })
        await db.cashBalanceHistory.upsert({
          where: { accountId_date: { accountId: cashAccount.id, date: txDate } },
          update: { balance: newBalance },
          create: { accountId: cashAccount.id, balance: newBalance, date: txDate },
        })
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
