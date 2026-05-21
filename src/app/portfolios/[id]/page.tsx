import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { computePortfolioPerformance } from '@/lib/calculations'
import { computeCGTReport, currentFY, getFYLabel } from '@/lib/tax'
import { HoldingsTable } from '@/components/portfolio/HoldingsTable'
import { ReconcileModal } from '@/components/portfolio/ReconcileModal'
import { PerformanceSummary } from '@/components/portfolio/PerformanceSummary'
import { AllocationChart } from '@/components/portfolio/AllocationChart'
import { DividendsSection } from '@/components/portfolio/DividendsSection'
import { PortfolioValueChart } from '@/components/portfolio/PortfolioValueChart'
import { PortfolioActionsMenu } from '@/components/portfolio/PortfolioActionsMenu'
import { recordSnapshot } from '@/lib/snapshots'
import { calcTermDeposit } from '@/lib/termDeposit'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate, gainClass } from '@/lib/formatters'

export const dynamic = 'force-dynamic'

function fmtCcy(v: number, currency: string) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v)
}

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

  const isTd = portfolio.portfolioType === 'TERM_DEPOSIT'

  // ── Term Deposit branch ────────────────────────────────────────────────────
  if (isTd) {
    const isClosed = Boolean(portfolio.tdClosedAt)

    // For a closed TD use the locked close value; otherwise calculate live
    const td = !isClosed && portfolio.tdPrincipal && portfolio.tdRate && portfolio.tdStartDate && portfolio.tdMaturityDate
      ? calcTermDeposit(portfolio.tdPrincipal, portfolio.tdRate, portfolio.tdStartDate, portfolio.tdMaturityDate)
      : null

    const displayValue = isClosed
      ? (portfolio.tdClosedValue ?? portfolio.tdPrincipal ?? 0)
      : (td?.currentValue ?? 0)

    const displayInterest = isClosed
      ? ((portfolio.tdClosedValue ?? 0) - (portfolio.tdPrincipal ?? 0))
      : (td?.accruedInterest ?? 0)

    if (displayValue > 0) {
      void recordSnapshot(portfolio.id, displayValue, portfolio.tdPrincipal ?? 0)
    }

    const maturityDateStr = portfolio.tdMaturityDate?.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    const startDateStr    = portfolio.tdStartDate?.toLocaleDateString('en-AU',    { day: 'numeric', month: 'short', year: 'numeric' })
    const closedDateStr   = portfolio.tdClosedAt?.toLocaleDateString('en-AU',     { day: 'numeric', month: 'short', year: 'numeric' })

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{portfolio.name}</h1>
              <Badge variant="blue">{portfolio.currency}</Badge>
              <Badge variant="gray">Term Deposit</Badge>
              {isClosed
                ? <Badge variant="yellow">Closed</Badge>
                : td?.isMatured && <Badge variant="green">Matured</Badge>}
            </div>
            {portfolio.description && (
              <p className="text-sm text-gray-500 mt-1">{portfolio.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={`/portfolios/${id}/edit`}>
              <Button size="sm" variant="ghost">{isClosed ? 'View' : 'Edit'}</Button>
            </Link>
          </div>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {isClosed ? 'Final Value' : 'Current Value'}
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {fmtCcy(displayValue, portfolio.currency)}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Principal</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {portfolio.tdPrincipal != null ? fmtCcy(portfolio.tdPrincipal, portfolio.currency) : '—'}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {isClosed ? 'Interest Earned' : 'Accrued Interest'}
            </p>
            <p className="text-xl font-bold text-emerald-700 mt-1">
              {displayInterest > 0 ? `+${fmtCcy(displayInterest, portfolio.currency)}` : '—'}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {isClosed ? 'Closed On' : 'Total at Maturity'}
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {isClosed
                ? (closedDateStr ?? '—')
                : td && portfolio.tdPrincipal != null
                  ? fmtCcy(portfolio.tdPrincipal + td.totalInterest, portfolio.currency)
                  : '—'}
            </p>
          </Card>
        </div>

        {/* TD details card */}
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">Term Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Interest Rate</p>
              <p className="font-semibold text-gray-900">{portfolio.tdRate != null ? `${portfolio.tdRate}% p.a.` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Term</p>
              <p className="font-semibold text-gray-900">{portfolio.tdTermMonths != null ? `${portfolio.tdTermMonths} months` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Interest Payment</p>
              <p className="font-semibold text-gray-900">
                {portfolio.tdInterestFreq === 'AT_MATURITY' ? 'At Maturity'
                  : portfolio.tdInterestFreq === 'MONTHLY' ? 'Monthly'
                  : portfolio.tdInterestFreq === 'QUARTERLY' ? 'Quarterly'
                  : portfolio.tdInterestFreq ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Start Date</p>
              <p className="font-semibold text-gray-900">{startDateStr ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                {isClosed ? 'Closed Date' : 'Maturity Date'}
              </p>
              <p className="font-semibold text-gray-900">{isClosed ? closedDateStr : maturityDateStr ?? '—'}</p>
            </div>
            {!isClosed && td && !td.isMatured && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Days Remaining</p>
                <p className="font-semibold text-gray-900">{td.daysRemaining} days</p>
              </div>
            )}
          </div>

          {/* Progress bar — hidden when closed */}
          {!isClosed && td && (
            <div className="mt-6">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{startDateStr}</span>
                <span>{td.isMatured ? 'Matured' : `${td.progressPct.toFixed(0)}% of term elapsed`}</span>
                <span>{maturityDateStr}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${td.isMatured ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${td.progressPct}%` }}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Value chart */}
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">Value Over Time</h2>
          <PortfolioValueChart portfolioId={id} currency={portfolio.currency} />
        </Card>
      </div>
    )
  }

  // ── Shares branch ──────────────────────────────────────────────────────────
  const [transactions, pendingCount, tickerSettings] = await Promise.all([
    prisma.transaction.findMany({
      where: { portfolioId: id },
      orderBy: { date: 'asc' },
    }),
    prisma.pendingTransaction.count({
      where: { portfolioId: id, status: 'PENDING' },
    }),
    prisma.tickerSetting.findMany({ where: { portfolioId: id } }),
  ])
  const drpTickers = Object.fromEntries(tickerSettings.map((s) => [s.ticker, s.drpEnabled]))

  const tickers = [...new Set(transactions.map((t) => t.ticker.toUpperCase()))]
  const priceMap = await getCachedAsxQuotes(tickers)

  const performance = computePortfolioPerformance(
    portfolio.id,
    portfolio.name,
    portfolio.currency,
    transactions,
    priceMap
  )

  void recordSnapshot(portfolio.id, performance.currentMarketValue, performance.totalInvested)

  // CGT events in the current FY — for "Sold This FY" section
  const fy = currentFY()
  const cgtReport = computeCGTReport(transactions, fy)
  // Group by ticker so we can show a summary row per stock
  const soldThisFY = Object.values(
    cgtReport.events.reduce<Record<string, {
      ticker: string; qtySold: number; proceeds: number; costBase: number;
      realisedGain: number; assessableGain: number; hasDiscount: boolean; lastSellDate: Date
    }>>((acc, e) => {
      if (!acc[e.ticker]) {
        acc[e.ticker] = { ticker: e.ticker, qtySold: 0, proceeds: 0, costBase: 0, realisedGain: 0, assessableGain: 0, hasDiscount: false, lastSellDate: e.sellDate }
      }
      acc[e.ticker].qtySold      += e.qty
      acc[e.ticker].proceeds     += e.proceeds
      acc[e.ticker].costBase     += e.costBase
      acc[e.ticker].realisedGain += e.grossGain
      acc[e.ticker].assessableGain += e.assessableGain
      if (e.discountEligible) acc[e.ticker].hasDiscount = true
      if (e.sellDate > acc[e.ticker].lastSellDate) acc[e.ticker].lastSellDate = e.sellDate
      return acc
    }, {})
  ).sort((a, b) => b.lastSellDate.getTime() - a.lastSellDate.getTime())

  const totalFrankingCredits = transactions
    .filter((tx) => tx.type === 'DIVIDEND' || tx.type === 'DRP')
    .reduce((sum, tx) => {
      const stored = tx.frankingCredit ?? 0
      if (stored > 0) return sum + stored
      const cash = tx.type === 'DRP'
        ? (tx.amount ? Number(tx.amount) : Number(tx.quantity) * Number(tx.price))
        : Number(tx.amount ?? 0)
      const pct = tx.frankingPct ?? 0
      return sum + (cash / 0.70) * 0.30 * (pct / 100)
    }, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{portfolio.name}</h1>
          <Badge variant="blue">{portfolio.currency}</Badge>
        </div>
        {portfolio.description && (
          <p className="text-sm text-gray-500">{portfolio.description}</p>
        )}
        <PortfolioActionsMenu
          portfolioId={id}
          pendingCount={pendingCount}
          hasTransactions={transactions.length > 0}
        />
      </div>

      {transactions.length === 0 && (
        <Card>
          <div className="py-10 text-center">
            <p className="text-gray-500 text-sm mb-1">This portfolio has no transactions yet.</p>
            <p className="text-gray-400 text-xs mb-6">Add them one by one or import your full history from a CSV file.</p>
            <div className="flex justify-center gap-3">
              <Link href={`/portfolios/${id}/transactions/import`}>
                <Button>Import CSV</Button>
              </Link>
              <Link href={`/portfolios/${id}/transactions/new`}>
                <Button variant="secondary">Add Transaction</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {transactions.length > 0 && <>
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">Portfolio Value</h2>
          <PortfolioValueChart portfolioId={id} currency={portfolio.currency} />
        </Card>
        <PerformanceSummary performance={performance} />
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Holdings</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{performance.holdings.length} stocks</span>
              <ReconcileModal portfolioId={id} holdings={performance.holdings} />
            </div>
          </div>
          <div className="p-6">
            <HoldingsTable holdings={performance.holdings} currency={portfolio.currency} portfolioId={id} drpTickers={drpTickers} />
          </div>
        </Card>

        {soldThisFY.length > 0 && (
          <Card padding={false}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Sold in {getFYLabel(fy)}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Disposals this financial year · average cost basis</p>
              </div>
              <Link href={`/portfolios/${id}/tax/cgt`}>
                <Button size="sm" variant="secondary">Full CGT Report</Button>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-6 pb-3 pt-4 font-medium">Ticker</th>
                    <th className="pb-3 pt-4 pr-6 font-medium text-right">Qty Sold</th>
                    <th className="pb-3 pt-4 pr-6 font-medium text-right">Proceeds</th>
                    <th className="pb-3 pt-4 pr-6 font-medium text-right">Cost Base</th>
                    <th className="pb-3 pt-4 pr-6 font-medium text-right">Gross Gain</th>
                    <th className="pb-3 pt-4 pr-6 font-medium text-right">Assessable</th>
                    <th className="pb-3 pt-4 pr-6 font-medium">Last Sale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {soldThisFY.map((s) => (
                    <tr key={s.ticker} className="hover:bg-gray-50">
                      <td className="py-3 px-6 font-semibold text-gray-900">{s.ticker}</td>
                      <td className="py-3 pr-6 text-right text-gray-700">{s.qtySold.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      <td className="py-3 pr-6 text-right text-gray-700">{formatCurrency(s.proceeds, portfolio.currency)}</td>
                      <td className="py-3 pr-6 text-right text-gray-700">{formatCurrency(s.costBase, portfolio.currency)}</td>
                      <td className={`py-3 pr-6 text-right font-medium ${gainClass(s.realisedGain)}`}>
                        {formatCurrency(s.realisedGain, portfolio.currency)}
                      </td>
                      <td className={`py-3 pr-6 text-right font-medium ${gainClass(s.assessableGain)}`}>
                        {formatCurrency(s.assessableGain, portfolio.currency)}
                        {s.hasDiscount && (
                          <span className="ml-1.5 inline-block rounded bg-green-100 px-1 py-0.5 text-xs text-green-700 font-normal">50%</span>
                        )}
                      </td>
                      <td className="py-3 pr-6 text-gray-500">{formatDate(s.lastSellDate, 'short')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Portfolio Allocation</h2>
            <AllocationChart holdings={performance.holdings} currency={portfolio.currency} />
          </Card>
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Dividends Received</h2>
            <DividendsSection
              holdings={performance.holdings}
              total={performance.dividendsReceived}
              currency={portfolio.currency}
              frankingTotal={totalFrankingCredits}
            />
          </Card>
        </div>
      </>}
    </div>
  )
}
