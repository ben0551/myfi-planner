import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getOwnedCashAccount(id: string, userId: string) {
  const account = await prisma.cashAccount.findUnique({ where: { id } })
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
  const owned = await getOwnedCashAccount(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { name, institution, balance, currency, notes } = body

  const balanceChanged = balance !== undefined && balance !== owned.balance

  const account = await prisma.cashAccount.update({
    where: { id },
    data: {
      name,
      institution,
      balance,
      currency,
      notes,
      ...(balanceChanged ? { balanceUpdatedAt: new Date() } : {}),
    },
  })

  if (balanceChanged) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    await prisma.cashBalanceHistory.upsert({
      where: { accountId_date: { accountId: id, date: today } },
      update: { balance },
      create: { accountId: id, date: today, balance },
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
  const owned = await getOwnedCashAccount(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.cashAccount.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
