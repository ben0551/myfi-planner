import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface SellBody {
  salePrice: number
  soldDate: string          // ISO date string
  mortgagePayout?: number   // amount to clear off the mortgage (defaults to full balance)
  cashAccountId?: string    // where to deposit net proceeds
  cashAmount?: number       // net cash to deposit (salePrice - mortgagePayout by default)
  costBase?: number         // for INVESTMENT CGT calculation
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const property = await prisma.property.findUnique({
    where: { id },
    include: { mortgage: true },
  })

  if (!property || property.userId !== session.user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (property.soldDate) {
    return Response.json({ error: 'Property already sold' }, { status: 400 })
  }

  const body: SellBody = await req.json()
  const { salePrice, soldDate, mortgagePayout, cashAccountId, cashAmount, costBase } = body

  if (!salePrice || salePrice <= 0) {
    return Response.json({ error: 'Sale price is required' }, { status: 400 })
  }
  if (!soldDate) {
    return Response.json({ error: 'Settlement date is required' }, { status: 400 })
  }

  const actualPayoutAmount = property.mortgage
    ? (mortgagePayout ?? property.mortgage.currentBalance)
    : 0

  // Run all mutations in a transaction
  try {
  await prisma.$transaction(async (tx) => {
    // 1. Mark property as sold — store reversal data for unsell
    await tx.property.update({
      where: { id },
      data: {
        soldDate: new Date(soldDate),
        salePrice,
        costBase: costBase ?? null,
        currentValue: salePrice,
        preSaleValue: property.currentValue,
        mortgagePayoutAmount: actualPayoutAmount > 0 ? actualPayoutAmount : null,
        saleCashAccountId: cashAccountId ?? null,
        saleCashAmount: cashAmount && cashAmount > 0 ? cashAmount : null,
      },
    })

    // 2. Clear mortgage balance if applicable
    if (property.mortgage && actualPayoutAmount > 0) {
      await tx.mortgage.update({
        where: { propertyId: id },
        data: { currentBalance: Math.max(0, property.mortgage.currentBalance - actualPayoutAmount) },
      })
    }

    // 3. Deposit proceeds into cash account
    if (cashAccountId && cashAmount && cashAmount > 0) {
      const account = await tx.cashAccount.findUnique({ where: { id: cashAccountId } })
      if (account && account.userId === session.user.id) {
        const newBalance = account.balance + cashAmount
        await tx.cashAccount.update({
          where: { id: cashAccountId },
          data: { balance: newBalance, balanceUpdatedAt: new Date(soldDate) },
        })
        await tx.cashBalanceHistory.upsert({
          where: { accountId_date: { accountId: cashAccountId, date: new Date(soldDate) } },
          update: { balance: newBalance },
          create: { accountId: cashAccountId, balance: newBalance, date: new Date(soldDate) },
        })
      }
    }
  })
  } catch (err) {
    console.error('[sell property]', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: msg }, { status: 500 })
  }

  return Response.json({ ok: true })
}
