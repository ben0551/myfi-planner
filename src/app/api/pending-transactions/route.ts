import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') ?? 'PENDING'
  const isAdmin = session.user.role === 'ADMIN'

  // Admins see all pending (including SMTP-ingested with no userId)
  // Users see only their own
  const where: Record<string, unknown> = { status }
  if (!isAdmin) where.userId = session.user.id

  const items = await prisma.pendingTransaction.findMany({
    where,
    orderBy: { receivedAt: 'desc' },
    include: { portfolio: { select: { name: true } } },
  })
  return Response.json(items)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    source,
    rawContent,
    fromAddress,
    transactionType,
    ticker,
    quantity,
    price,
    fees,
    currency = 'AUD',
    tradeDate,
    parseConfidence,
    parseWarnings,
    portfolioId,
  } = body

  const item = await prisma.pendingTransaction.create({
    data: {
      source: source ?? 'email_paste',
      rawContent: rawContent ?? '',
      fromAddress: fromAddress ?? null,
      transactionType: transactionType ?? null,
      ticker: ticker ?? null,
      quantity: quantity ?? null,
      price: price ?? null,
      fees: fees ?? null,
      currency,
      tradeDate: tradeDate ? new Date(tradeDate) : null,
      parseConfidence: parseConfidence ?? null,
      parseWarnings: parseWarnings ? JSON.stringify(parseWarnings) : null,
      portfolioId: portfolioId ?? null,
      userId: session.user.id,
      status: 'PENDING',
    },
  })
  return Response.json(item, { status: 201 })
}
