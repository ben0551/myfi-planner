import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getOwnedEntry(propertyId: string, historyId: string, userId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } })
  if (!property || property.userId !== userId) return null
  const entry = await prisma.propertyValueHistory.findUnique({ where: { id: historyId } })
  if (!entry || entry.propertyId !== propertyId) return null
  return { property, entry }
}

/** PUT /api/wealth/properties/[id]/value/[historyId] — edit a valuation entry */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, historyId } = await params
  const owned = await getOwnedEntry(id, historyId, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const { value, date } = await request.json()
  if (typeof value !== 'number' || isNaN(value) || value < 0) {
    return Response.json({ error: 'Invalid value' }, { status: 400 })
  }

  const newDate = date ? new Date(date) : owned.entry.date

  // If the date changed, delete old and create new (date is part of the unique key)
  let updated
  if (newDate.getTime() !== owned.entry.date.getTime()) {
    await prisma.propertyValueHistory.delete({ where: { id: historyId } })
    updated = await prisma.propertyValueHistory.create({
      data: { propertyId: id, date: newDate, value },
    })
  } else {
    updated = await prisma.propertyValueHistory.update({
      where: { id: historyId },
      data: { value },
    })
  }

  // Sync currentValue to latest history entry
  const latest = await prisma.propertyValueHistory.findFirst({
    where: { propertyId: id },
    orderBy: { date: 'desc' },
  })
  if (latest) {
    await prisma.property.update({ where: { id }, data: { currentValue: latest.value } })
  }

  return Response.json(updated)
}

/** DELETE /api/wealth/properties/[id]/value/[historyId] — remove a valuation entry */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, historyId } = await params
  const owned = await getOwnedEntry(id, historyId, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.propertyValueHistory.delete({ where: { id: historyId } })

  // Sync currentValue to new latest (or fall back to purchasePrice if history is now empty)
  const latest = await prisma.propertyValueHistory.findFirst({
    where: { propertyId: id },
    orderBy: { date: 'desc' },
  })
  await prisma.property.update({
    where: { id },
    data: { currentValue: latest ? latest.value : owned.property.purchasePrice },
  })

  return new Response(null, { status: 204 })
}
