import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toCsv, csvResponse, safeFilename } from '@/lib/csv'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'asc' },
  })

  const csv = toCsv(
    ['Date', 'Type', 'Ticker', 'Quantity', 'Price', 'Fees', 'Amount', 'Franking %', 'Franking Credit', 'Notes'],
    transactions.map((t) => [
      new Date(t.date).toISOString().split('T')[0],
      t.type,
      t.ticker,
      t.quantity.toString(),
      t.price.toString(),
      t.fees.toString(),
      t.amount?.toString() ?? '',
      t.frankingPct?.toString() ?? '0',
      t.frankingCredit?.toString() ?? '0',
      t.notes ?? '',
    ]),
  )

  return csvResponse(csv, `${safeFilename(portfolio.name)}_transactions.csv`)
}
