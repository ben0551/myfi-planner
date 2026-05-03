import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getOwnedSuperAccount(id: string, userId: string) {
  const account = await prisma.superAccount.findUnique({ where: { id } })
  if (!account) return null
  if (account.userId !== userId) return null
  return account
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedSuperAccount(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const {
    fundName,
    accountNumber,
    currentBalance,
    employerContribPct,
    employeeContribPct,
    annualSalary,
    maxConcessional,
    currency,
    notes,
  } = body

  const balanceChanged =
    currentBalance !== undefined && currentBalance !== owned.currentBalance

  const account = await prisma.superAccount.update({
    where: { id },
    data: {
      fundName,
      accountNumber,
      currentBalance,
      employerContribPct,
      employeeContribPct,
      annualSalary: annualSalary ?? null,
      maxConcessional: maxConcessional ?? false,
      currency,
      notes,
      ...(balanceChanged ? { balanceUpdatedAt: new Date() } : {}),
    },
  })

  if (balanceChanged) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    await prisma.superBalanceHistory.upsert({
      where: { accountId_date: { accountId: id, date: today } },
      update: { balance: currentBalance },
      create: { accountId: id, date: today, balance: currentBalance },
    })
  }

  return Response.json(account)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedSuperAccount(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.superAccount.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
