import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { calcTermDeposit } from '@/lib/termDeposit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({ where: { id, userId: session.user.id } })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })
  if (portfolio.portfolioType !== 'TERM_DEPOSIT') {
    return Response.json({ error: 'Not a term deposit' }, { status: 400 })
  }
  if (portfolio.tdClosedAt) {
    return Response.json({ error: 'Already closed' }, { status: 400 })
  }

  const { closeDate, cashAccountId } = await request.json()
  const closeAt = closeDate ? new Date(closeDate) : new Date()

  // Calculate value at close date
  let closeValue = portfolio.tdPrincipal ?? 0
  if (portfolio.tdPrincipal && portfolio.tdRate && portfolio.tdStartDate && portfolio.tdMaturityDate) {
    // Use closeDate as the effective maturity to get accrued interest up to that point
    const effectiveMaturity = closeAt < portfolio.tdMaturityDate ? closeAt : portfolio.tdMaturityDate
    const td = calcTermDeposit(portfolio.tdPrincipal, portfolio.tdRate, portfolio.tdStartDate, effectiveMaturity)
    closeValue = td.currentValue
  }

  // Mark portfolio as closed
  const updated = await prisma.portfolio.update({
    where: { id },
    data: { tdClosedAt: closeAt, tdClosedValue: closeValue },
  })

  // Optionally transfer proceeds to a cash account
  if (cashAccountId) {
    const cashAccount = await prisma.cashAccount.findUnique({
      where: { id: cashAccountId, userId: session.user.id },
    })
    if (cashAccount) {
      const newBalance = cashAccount.balance + closeValue
      await prisma.$transaction([
        prisma.cashAccount.update({
          where: { id: cashAccountId },
          data: { balance: newBalance, balanceUpdatedAt: closeAt },
        }),
        prisma.cashBalanceHistory.upsert({
          where: { accountId_date: { accountId: cashAccountId, date: closeAt } },
          create: { accountId: cashAccountId, date: closeAt, balance: newBalance },
          update: { balance: newBalance },
        }),
      ])
    }
  }

  return Response.json({ portfolio: updated, closeValue })
}
