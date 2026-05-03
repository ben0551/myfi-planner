import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CreateInheritanceSchema, parseBody } from '@/lib/schemas'

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

  const result = await parseBody(request, CreateInheritanceSchema)
  if (!result.ok) return result.response
  const data = result.data

  const item = await prisma.anticipatedInheritance.create({
    data: {
      userId: session.user.id,
      name: data.name,
      amount: data.amount,
      expectedYear: data.expectedYear,
      probability: data.probability,
      currency: data.currency,
      notes: data.notes ?? null,
      includeInFire: data.includeInFire,
    },
  })
  return Response.json(item, { status: 201 })
}
