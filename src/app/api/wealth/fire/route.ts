import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.fireSettings.findUnique({
    where: { userId: session.user.id },
  })
  if (!settings) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(settings)
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    annualExpenses,
    withdrawalRate,
    expectedReturn,
    inflationRate,
    superGrowthRate,
    monthlySavings,
    yearOfBirth,
    targetRetireAge,
    includeSuper,
    includePropertyEquity,
    includeCash,
    notes,
  } = body

  const data = {
    annualExpenses,
    withdrawalRate,
    expectedReturn,
    inflationRate,
    superGrowthRate: superGrowthRate ?? 9.0,
    monthlySavings,
    yearOfBirth,
    targetRetireAge,
    includeSuper,
    includePropertyEquity,
    includeCash,
    notes,
  }

  const settings = await prisma.fireSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  })
  return Response.json(settings)
}
