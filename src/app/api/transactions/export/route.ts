import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toCsv, csvResponse } from '@/lib/csv'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const transactions = await prisma.transaction.findMany({
    where: { portfolio: { userId: session.user.id } },
    include: { portfolio: { select: { name: true, currency: true } } },
    orderBy: [{ date: 'asc' }, { ticker: 'asc' }],
  })

  const csv = toCsv(
    ['Date', 'Portfolio', 'Currency', 'Type', 'Ticker', 'Quantity', 'Price', 'Fees', 'Amount', 'Franking %', 'Franking Credit', 'Notes'],
    transactions.map((t) => [
      new Date(t.date).toISOString().split('T')[0],
      t.portfolio.name,
      t.portfolio.currency,
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

  const today = new Date().toISOString().split('T')[0]
  return csvResponse(csv, `transactions_${today}.csv`)
}
