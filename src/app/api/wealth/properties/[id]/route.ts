import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getOwnedProperty(id: string, userId: string) {
  const property = await prisma.property.findUnique({ where: { id }, include: { mortgage: true } })
  if (!property) return null
  if (property.userId !== userId) return null
  return property
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const property = await getOwnedProperty(id, session.user.id)
  if (!property) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({
    id: property.id,
    name: property.name,
    type: property.type,
    purchasePrice: property.purchasePrice,
    purchaseDate: property.purchaseDate.toISOString().split('T')[0],
    currentValue: property.currentValue,
    currency: property.currency,
    soldDate: property.soldDate?.toISOString().split('T')[0] ?? null,
    salePrice: property.salePrice ?? null,
    costBase: property.costBase ?? null,
    mortgage: property.mortgage
      ? { currentBalance: property.mortgage.currentBalance, lender: property.mortgage.lender }
      : null,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedProperty(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const {
    name,
    address,
    type,
    purchasePrice,
    purchaseDate,
    currentValue,
    ownershipPct,
    currency,
    notes,
  } = body

  const valueChanged = currentValue !== undefined && currentValue !== owned.currentValue

  const property = await prisma.property.update({
    where: { id },
    data: {
      name,
      address,
      type,
      purchasePrice,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      currentValue,
      ownershipPct,
      currency,
      notes,
    },
    include: { mortgage: true },
  })

  if (valueChanged) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    await prisma.propertyValueHistory.upsert({
      where: { propertyId_date: { propertyId: id, date: today } },
      update: { value: currentValue },
      create: { propertyId: id, date: today, value: currentValue },
    })
  }

  return Response.json(property)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await getOwnedProperty(id, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.property.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
