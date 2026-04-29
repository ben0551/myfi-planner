import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getOwnedCashAccount(id: string, userId: string) {
  const account = await prisma.cashAccount.findUnique({ where: { id } })
  if (!account || account.userId !== userId) return null
  return account
}

/** GET /api/wealth/cash/[id]/balance — list balance history */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedCashAccount(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const history = await prisma.cashBalanceHistory.findMany({
    where: { accountId: id },
    orderBy: { date: 'desc' },
  })
  return Response.json(history)
}

/**
 * POST /api/wealth/cash/[id]/balance — record a balance entry.
 * Updates balance on the CashAccount too.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedCashAccount(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { balance, date } = body

  if (typeof balance !== 'number' || isNaN(balance) || balance < 0) {
    return Response.json({ error: 'Invalid balance' }, { status: 400 })
  }

  const recordDate = date ? new Date(date) : new Date()

  const [entry] = await prisma.$transaction([
    prisma.cashBalanceHistory.upsert({
      where: { accountId_date: { accountId: id, date: recordDate } },
      create: { accountId: id, date: recordDate, balance },
      update: { balance },
    }),
    prisma.cashAccount.update({
      where: { id },
      data: { balance, balanceUpdatedAt: recordDate },
    }),
  ])

  return Response.json(entry, { status: 201 })
}
