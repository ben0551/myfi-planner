import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PendingInbox, type CashAccountOption } from '@/components/portfolio/PendingInbox'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PortfolioInboxPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params

  const [portfolio, pending, cashAccounts, tickerSettings] = await Promise.all([
    prisma.portfolio.findUnique({ where: { id, userId: session.user.id } }),
    prisma.pendingTransaction.findMany({
      where: { portfolioId: id, status: 'PENDING' },
      orderBy: { tradeDate: 'asc' },
    }),
    prisma.cashAccount.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, institution: true, balance: true, currency: true },
    }),
    prisma.tickerSetting.findMany({ where: { portfolioId: id } }),
  ])
  const drpTickers = Object.fromEntries(tickerSettings.map((s) => [s.ticker, s.drpEnabled]))
  if (!portfolio) notFound()

  const serialised = pending.map((p) => ({
    id: p.id,
    source: p.source,
    transactionType: p.transactionType,
    ticker: p.ticker,
    quantity: p.quantity ? Number(p.quantity) : null,
    price: p.price ? Number(p.price) : null,
    fees: p.fees ? Number(p.fees) : null,
    currency: p.currency,
    tradeDate: p.tradeDate?.toISOString() ?? null,
    parseWarnings: p.parseWarnings,
    rawContent: p.rawContent,
  }))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href={`/portfolios/${id}`} className="hover:text-indigo-600">{portfolio.name}</Link>
          <span>/</span>
          <span>Pending Transactions</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Pending Transactions</h1>
          {pending.length > 0 && <Badge variant="blue">{pending.length}</Badge>}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Review and confirm dividend transactions synced from Yahoo Finance.
        </p>
      </div>

      {pending.length === 0 ? (
        <Card className="text-center py-10 text-gray-500 text-sm">
          No pending transactions — everything is up to date.
        </Card>
      ) : (
        <PendingInbox
          items={serialised}
          portfolioId={id}
          cashAccounts={cashAccounts}
          drpTickers={drpTickers}
        />
      )}
    </div>
  )
}
