import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
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
  if (!property.soldDate) {
    return Response.json({ error: 'Property is not sold' }, { status: 400 })
  }

  const soldDateStr = property.soldDate.toISOString().split('T')[0]

  await prisma.$transaction(async (tx) => {
    // 1. Clear sale fields and restore pre-sale currentValue
    await tx.property.update({
      where: { id },
      data: {
        soldDate: null,
        salePrice: null,
        costBase: null,
        currentValue: property.preSaleValue ?? property.purchasePrice,
        mortgagePayoutAmount: null,
        saleCashAccountId: null,
        saleCashAmount: null,
        preSaleValue: null,
      },
    })

    // 2. Restore mortgage balance — add back the payout amount
    if (property.mortgage && property.mortgagePayoutAmount && property.mortgagePayoutAmount > 0) {
      await tx.mortgage.update({
        where: { propertyId: id },
        data: {
          currentBalance: property.mortgage.currentBalance + property.mortgagePayoutAmount,
        },
      })
    }

    // 3. Reverse the cash account credit
    if (property.saleCashAccountId && property.saleCashAmount && property.saleCashAmount > 0) {
      const account = await tx.cashAccount.findUnique({
        where: { id: property.saleCashAccountId },
      })
      if (account && account.userId === session.user.id) {
        const restoredBalance = account.balance - property.saleCashAmount

        await tx.cashAccount.update({
          where: { id: property.saleCashAccountId },
          data: { balance: restoredBalance },
        })

        // Remove the cash history entry recorded at the sold date
        await tx.cashBalanceHistory.deleteMany({
          where: {
            accountId: property.saleCashAccountId,
            date: property.soldDate!,
          },
        })
      }
    }
  })

  return Response.json({ ok: true })
}
