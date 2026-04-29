import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getOwnedProperty(id: string, userId: string) {
  const property = await prisma.property.findUnique({ where: { id } })
  if (!property || property.userId !== userId) return null
  return property
}

/** GET /api/wealth/properties/[id]/value — list value history */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedProperty(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const history = await prisma.propertyValueHistory.findMany({
    where: { propertyId: id },
    orderBy: { date: 'desc' },
  })
  return Response.json(history)
}

/**
 * POST /api/wealth/properties/[id]/value — record a value entry.
 * Updates currentValue on the Property too.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedProperty(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { value, date } = body

  if (typeof value !== 'number' || isNaN(value) || value < 0) {
    return Response.json({ error: 'Invalid value' }, { status: 400 })
  }

  const recordDate = date ? new Date(date) : new Date()

  const [entry] = await prisma.$transaction([
    prisma.propertyValueHistory.upsert({
      where: { propertyId_date: { propertyId: id, date: recordDate } },
      create: { propertyId: id, date: recordDate, value },
      update: { value },
    }),
    prisma.property.update({
      where: { id },
      data: { currentValue: value },
    }),
  ])

  return Response.json(entry, { status: 201 })
}
