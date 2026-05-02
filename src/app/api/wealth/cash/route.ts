import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await prisma.cashAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' },
  })
  return Response.json(accounts)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, institution, balance, currency, notes, openingDate } = body

  const firstDate = openingDate ? new Date(openingDate) : new Date()
  firstDate.setHours(0, 0, 0, 0)

  const account = await prisma.cashAccount.create({
    data: {
      userId: session.user.id,
      name,
      institution,
      balance,
      currency,
      notes,
      balanceUpdatedAt: firstDate,
    },
  })

  await prisma.cashBalanceHistory.upsert({
    where: { accountId_date: { accountId: account.id, date: firstDate } },
    update: { balance },
    create: { accountId: account.id, date: firstDate, balance },
  })

  return Response.json(account, { status: 201 })
}
