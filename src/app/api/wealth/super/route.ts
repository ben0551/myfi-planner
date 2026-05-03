import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { CreateSuperSchema, parseBody } from '@/lib/schemas'

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

  const result = await parseBody(request, CreateSuperSchema)
  if (!result.ok) return result.response
  const data = result.data

  const account = await prisma.superAccount.create({
    data: {
      userId: session.user.id,
      fundName: data.fundName,
      accountNumber: data.accountNumber ?? null,
      currentBalance: data.currentBalance,
      employerContribPct: data.employerContribPct,
      employeeContribPct: data.employeeContribPct,
      annualSalary: data.annualSalary ?? null,
      maxConcessional: data.maxConcessional,
      currency: data.currency,
      notes: data.notes ?? null,
      balanceUpdatedAt: new Date(),
    },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  await prisma.superBalanceHistory.upsert({
    where: { accountId_date: { accountId: account.id, date: today } },
    update: { balance: data.currentBalance },
    create: { accountId: account.id, date: today, balance: data.currentBalance },
  })

  return Response.json(account, { status: 201 })
}
