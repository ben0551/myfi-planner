import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({ where: { id, userId: session.user.id } })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  const settings = await prisma.tickerSetting.findMany({ where: { portfolioId: id } })
  return Response.json(settings)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({ where: { id, userId: session.user.id } })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  const { ticker, drpEnabled } = await request.json()
  if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 })

  const setting = await prisma.tickerSetting.upsert({
    where: { portfolioId_ticker: { portfolioId: id, ticker: ticker.toUpperCase() } },
    update: { drpEnabled },
    create: { portfolioId: id, ticker: ticker.toUpperCase(), drpEnabled },
  })

  return Response.json(setting)
}
