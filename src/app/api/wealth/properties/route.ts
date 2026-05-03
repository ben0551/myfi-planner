import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { CreatePropertySchema, parseBody } from '@/lib/schemas'

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

  const result = await parseBody(request, CreatePropertySchema)
  if (!result.ok) return result.response
  const data = result.data

  const property = await prisma.property.create({
    data: {
      userId: session.user.id,
      name: data.name,
      address: data.address ?? null,
      type: data.type,
      purchasePrice: data.purchasePrice,
      purchaseDate: new Date(data.purchaseDate),
      currentValue: data.currentValue,
      ownershipPct: data.ownershipPct,
      currency: data.currency,
      notes: data.notes ?? null,
    },
    include: { mortgage: true },
  })

  // Record initial value history entries
  const purchaseDateObj = new Date(data.purchaseDate)
  purchaseDateObj.setHours(0, 0, 0, 0)
  const historyEntries: { propertyId: string; date: Date; value: number }[] = [
    { propertyId: property.id, date: purchaseDateObj, value: data.purchasePrice },
  ]
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  // Add today's value if different from purchase price (i.e. already appreciated/depreciated)
  if (data.currentValue !== data.purchasePrice && purchaseDateObj < todayMidnight) {
    historyEntries.push({ propertyId: property.id, date: todayMidnight, value: data.currentValue })
  }
  await prisma.propertyValueHistory.createMany({ data: historyEntries, skipDuplicates: true })

  return Response.json(property, { status: 201 })
}
