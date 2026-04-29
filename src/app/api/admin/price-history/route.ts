import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ticker = req.nextUrl.searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const rows = await prisma.historicalPrice.findMany({
    where: { ticker: ticker.toUpperCase(), source: 'ASX' },
    orderBy: { date: 'desc' },
    select: { date: true, close: true, volume: true },
  })

  return NextResponse.json({
    ticker: ticker.toUpperCase(),
    count: rows.length,
    prices: rows.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      close: Number(r.close),
      volume: r.volume ?? null,
    })),
  })
}
