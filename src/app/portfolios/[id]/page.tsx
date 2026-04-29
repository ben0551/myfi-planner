import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { computePortfolioPerformance } from '@/lib/calculations'
import { HoldingsTable } from '@/components/portfolio/HoldingsTable'
import { PerformanceSummary } from '@/components/portfolio/PerformanceSummary'
import { AllocationChart } from '@/components/portfolio/AllocationChart'
import { DividendsSection } from '@/components/portfolio/DividendsSection'
import { PortfolioValueChart } from '@/components/portfolio/PortfolioValueChart'
import { recordSnapshot } from '@/lib/snapshots'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({ where: { id, userId: session.user.id } })
  if (!portfolio) notFound()

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'asc' },
  })

  const tickers = [...new Set(transactions.map((t) => t.ticker.toUpperCase()))]
  const priceMap = await getCachedAsxQuotes(tickers)

  const performance = computePortfolioPerformance(
    portfolio.id,
    portfolio.name,
    portfolio.currency,
    transactions,
    priceMap
  )

  // Record today's snapshot (fire-and-forget; non-fatal)
  void recordSnapshot(portfolio.id, performance.currentMarketValue, performance.totalInvested)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{portfolio.name}</h1>
            <Badge variant="blue">{portfolio.currency}</Badge>
          </div>
          {portfolio.description && (
            <p className="text-sm text-gray-500 mt-1">{portfolio.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/portfolios/${id}/transactions/new`}>
            <Button size="sm">+ Add Transaction</Button>
          </Link>
          <Link href={`/portfolios/${id}/transactions`}>
            <Button size="sm" variant="secondary">History</Button>
          </Link>
          <Link href={`/portfolios/${id}/analysis`}>
            <Button size="sm" variant="secondary">Analysis</Button>
          </Link>
          <Link href={`/portfolios/${id}/tax`}>
            <Button size="sm" variant="secondary">Tax Report</Button>
          </Link>
          <Link href={`/portfolios/${id}/goals`}>
            <Button size="sm" variant="secondary">Goals</Button>
          </Link>
          <a href={`/api/portfolios/${id}/export`} download>
            <Button size="sm" variant="secondary">Export CSV</Button>
          </a>
          <Link href={`/portfolios/${id}/edit`}>
            <Button size="sm" variant="ghost">Edit</Button>
          </Link>
        </div>
      </div>

      {/* Performance summary */}
      <PerformanceSummary performance={performance} />

      {/* Holdings */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Holdings</h2>
          <span className="text-sm text-gray-500">{performance.holdings.length} stocks</span>
        </div>
        <div className="p-6">
          <HoldingsTable
            holdings={performance.holdings}
            currency={portfolio.currency}
            portfolioId={id}
          />
        </div>
      </Card>

      {/* Portfolio value over time */}
      <Card>
        <h2 className="font-semibold text-gray-900 mb-4">Portfolio Value</h2>
        <PortfolioValueChart portfolioId={id} currency={portfolio.currency} />
      </Card>

      {/* Allocation + Dividends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">Portfolio Allocation</h2>
          <AllocationChart
            holdings={performance.holdings}
            currency={portfolio.currency}
          />
        </Card>

        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">Dividends Received</h2>
          <DividendsSection
            holdings={performance.holdings}
            total={performance.dividendsReceived}
            currency={portfolio.currency}
          />
        </Card>
      </div>
    </div>
  )
}
