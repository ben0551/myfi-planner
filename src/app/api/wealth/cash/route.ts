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
  const { name, institution, balance, currency, notes } = body

  const account = await prisma.cashAccount.create({
    data: {
      userId: session.user.id,
      name,
      institution,
      balance,
      currency,
      notes,
    },
  })
  return Response.json(account, { status: 201 })
}
