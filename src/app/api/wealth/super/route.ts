import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await prisma.superAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { fundName: 'asc' },
  })
  return Response.json(accounts)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    fundName,
    accountNumber,
    currentBalance,
    employerContribPct,
    employeeContribPct,
    currency,
    notes,
  } = body

  const account = await prisma.superAccount.create({
    data: {
      userId: session.user.id,
      fundName,
      accountNumber,
      currentBalance,
      employerContribPct,
      employeeContribPct,
      currency,
      notes,
      balanceUpdatedAt: new Date(),
    },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  await prisma.superBalanceHistory.upsert({
    where: { accountId_date: { accountId: account.id, date: today } },
    update: { balance: currentBalance },
    create: { accountId: account.id, date: today, balance: currentBalance },
  })

  return Response.json(account, { status: 201 })
}
