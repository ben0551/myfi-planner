import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getOwnedEntry(accountId: string, historyId: string, userId: string) {
  const account = await prisma.cashAccount.findUnique({ where: { id: accountId } })
  if (!account || account.userId !== userId) return null
  const entry = await prisma.cashBalanceHistory.findUnique({ where: { id: historyId } })
  if (!entry || entry.accountId !== accountId) return null
  return { account, entry }
}

/** PUT /api/wealth/cash/[id]/balance/[historyId] — edit a balance history entry */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, historyId } = await params
  const owned = await getOwnedEntry(id, historyId, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const { balance, date } = await request.json()
  if (typeof balance !== 'number' || isNaN(balance) || balance < 0) {
    return Response.json({ error: 'Invalid balance' }, { status: 400 })
  }

  const newDate = date ? new Date(date) : owned.entry.date

  let updated
  if (newDate.getTime() !== owned.entry.date.getTime()) {
    await prisma.cashBalanceHistory.delete({ where: { id: historyId } })
    updated = await prisma.cashBalanceHistory.create({
      data: { accountId: id, date: newDate, balance },
    })
  } else {
    updated = await prisma.cashBalanceHistory.update({
      where: { id: historyId },
      data: { balance },
    })
  }

  // Sync account balance to latest entry
  const latest = await prisma.cashBalanceHistory.findFirst({
    where: { accountId: id },
    orderBy: { date: 'desc' },
  })
  if (latest) {
    await prisma.cashAccount.update({
      where: { id },
      data: { balance: latest.balance, balanceUpdatedAt: latest.date },
    })
  }

  return Response.json(updated)
}

/** DELETE /api/wealth/cash/[id]/balance/[historyId] — remove a balance entry */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, historyId } = await params
  const owned = await getOwnedEntry(id, historyId, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.cashBalanceHistory.delete({ where: { id: historyId } })

  const latest = await prisma.cashBalanceHistory.findFirst({
    where: { accountId: id },
    orderBy: { date: 'desc' },
  })
  if (latest) {
    await prisma.cashAccount.update({
      where: { id },
      data: { balance: latest.balance, balanceUpdatedAt: latest.date },
    })
  }

  return new Response(null, { status: 204 })
}
