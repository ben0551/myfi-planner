import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { CreateCashSchema, parseBody } from '@/lib/schemas'

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

  const result = await parseBody(request, CreateCashSchema)
  if (!result.ok) return result.response
  const data = result.data

  const firstDate = data.openingDate ? new Date(data.openingDate) : new Date()
  firstDate.setHours(0, 0, 0, 0)

  const account = await prisma.cashAccount.create({
    data: {
      userId: session.user.id,
      name: data.name,
      institution: data.institution ?? null,
      balance: data.balance,
      currency: data.currency,
      notes: data.notes ?? null,
      balanceUpdatedAt: firstDate,
    },
  })

  await prisma.cashBalanceHistory.upsert({
    where: { accountId_date: { accountId: account.id, date: firstDate } },
    update: { balance: data.balance },
    create: { accountId: account.id, date: firstDate, balance: data.balance },
  })

  return Response.json(account, { status: 201 })
}
