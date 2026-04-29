import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const items = await prisma.anticipatedInheritance.findMany({
    where: { userId: session.user.id },
    orderBy: { expectedYear: 'asc' },
  })
  return Response.json(items)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, amount, expectedYear, probability = 100, currency = 'AUD', notes, includeInFire = true } = body

  if (!name || !amount || !expectedYear) {
    return Response.json({ error: 'name, amount and expectedYear are required' }, { status: 400 })
  }

  const item = await prisma.anticipatedInheritance.create({
    data: {
      userId: session.user.id,
      name,
      amount: parseFloat(amount),
      expectedYear: parseInt(expectedYear),
      probability: parseInt(probability),
      currency,
      notes: notes || null,
      includeInFire,
    },
  })
  return Response.json(item, { status: 201 })
}
