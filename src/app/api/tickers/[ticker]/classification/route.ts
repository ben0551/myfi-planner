import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker } = await params
  const upper = ticker.toUpperCase()

  const classification = await prisma.tickerClassification.findUnique({ where: { ticker: upper } })
  if (!classification) return Response.json(null)

  return Response.json({
    ...classification,
    assetClasses: classification.assetClasses ? JSON.parse(classification.assetClasses) : [],
    industries:   classification.industries   ? JSON.parse(classification.industries)   : [],
    regions:      classification.regions      ? JSON.parse(classification.regions)      : [],
    customGroups: classification.customGroups ? JSON.parse(classification.customGroups) : [],
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker } = await params
  const upper = ticker.toUpperCase()
  const body = await request.json()

  const data = {
    instrumentType: body.instrumentType ?? null,
    riskCategory:   body.riskCategory ?? null,
    assetClasses:   body.assetClasses?.length  ? JSON.stringify(body.assetClasses)  : null,
    industries:     body.industries?.length    ? JSON.stringify(body.industries)    : null,
    regions:        body.regions?.length       ? JSON.stringify(body.regions)       : null,
    customGroups:   body.customGroups?.length  ? JSON.stringify(body.customGroups)  : null,
    notes:          body.notes ?? null,
  }

  const classification = await prisma.tickerClassification.upsert({
    where: { ticker: upper },
    update: data,
    create: { ticker: upper, ...data },
  })

  return Response.json({
    ...classification,
    assetClasses: classification.assetClasses ? JSON.parse(classification.assetClasses) : [],
    industries:   classification.industries   ? JSON.parse(classification.industries)   : [],
    regions:      classification.regions      ? JSON.parse(classification.regions)      : [],
    customGroups: classification.customGroups ? JSON.parse(classification.customGroups) : [],
  })
}
