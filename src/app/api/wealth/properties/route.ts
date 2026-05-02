import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const properties = await prisma.property.findMany({
    where: { userId: session.user.id },
    include: { mortgage: true },
    orderBy: { name: 'asc' },
  })

  // Sync currentValue to the latest history entry for any properties that are out of sync.
  // This self-heals data if a historical valuation was added after a more recent one.
  const latestHistory = await prisma.propertyValueHistory.findMany({
    where: { propertyId: { in: properties.map((p) => p.id) } },
    orderBy: { date: 'desc' },
    distinct: ['propertyId'],
  })
  const latestMap = new Map(latestHistory.map((h) => [h.propertyId, h.value]))

  await Promise.all(
    properties
      .filter((p) => {
        const latest = latestMap.get(p.id)
        return latest !== undefined && latest !== p.currentValue
      })
      .map((p) =>
        prisma.property.update({ where: { id: p.id }, data: { currentValue: latestMap.get(p.id)! } })
      )
  )

  // Reflect corrections in the returned data
  return Response.json(
    properties.map((p) => {
      const latest = latestMap.get(p.id)
      return latest !== undefined && latest !== p.currentValue
        ? { ...p, currentValue: Number(latest) }
        : p
    })
  )
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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

  const property = await prisma.property.create({
    data: {
      userId: session.user.id,
      name,
      address,
      type,
      purchasePrice,
      purchaseDate: new Date(purchaseDate),
      currentValue,
      ownershipPct,
      currency,
      notes,
    },
    include: { mortgage: true },
  })

  // Record initial value history entries
  const purchaseDateObj = new Date(purchaseDate)
  purchaseDateObj.setHours(0, 0, 0, 0)
  const historyEntries: { propertyId: string; date: Date; value: number }[] = [
    { propertyId: property.id, date: purchaseDateObj, value: purchasePrice },
  ]
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  // Add today's value if different from purchase price (i.e. already appreciated/depreciated)
  if (currentValue !== purchasePrice && purchaseDateObj < todayMidnight) {
    historyEntries.push({ propertyId: property.id, date: todayMidnight, value: currentValue })
  }
  await prisma.propertyValueHistory.createMany({ data: historyEntries, skipDuplicates: true })

  return Response.json(property, { status: 201 })
}
