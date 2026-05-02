import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computePortfolioPerformance } from '@/lib/calculations'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { calcTermDeposit } from '@/lib/termDeposit'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatNumber, formatPercent, gainClass } from '@/lib/formatters'

export const dynamic = 'force-dynamic'

export default async function ReportsPerformancePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id

  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    include: { transactions: { orderBy: { date: 'asc' } } },
    orderBy: { name: 'asc' },
  })

  // Split by type
  const sharePortfolios = portfolios.filter((p) => p.portfolioType !== 'TERM_DEPOSIT')
  const tdPortfolios = portfolios.filter((p) => p.portfolioType === 'TERM_DEPOSIT')

  // Collect all unique tickers from share portfolios only
  const allTickers = [
    ...new Set(
      sharePortfolios.flatMap((p) => p.transactions.map((t) => t.ticker.toUpperCase()))
    ),
  ]
  const priceMap = await getCachedAsxQuotes(allTickers)

  // Compute performance per share portfolio
  const performances = sharePortfolios.map((p) =>
    computePortfolioPerformance(p.id, p.name, p.currency, p.transactions, priceMap)
  )

  // Compute TD performance separately
  const tdPerformances = tdPortfolios.map((p) => {
    if (!p.tdPrincipal || !p.tdRate || !p.tdStartDate || !p.tdMaturityDate) {
      return { id: p.id, name: p.name, principal: 0, currentValue: 0, accruedInterest: 0, rate: 0 }
    }
    const td = calcTermDeposit(p.tdPrincipal, p.tdRate, p.tdStartDate, p.tdMaturityDate)
    return { id: p.id, name: p.name, principal: p.tdPrincipal, currentValue: td.currentValue, accruedInterest: td.accruedInterest, rate: p.tdRate }
  })

  // Aggregate totals
  const totals = performances.reduce(
    (acc, perf) => ({
      currentMarketValue: acc.currentMarketValue + perf.currentMarketValue,
      totalInvested: acc.totalInvested + perf.totalInvested,
      unrealisedGain: acc.unrealisedGain + perf.unrealisedGain,
      realisedGain: acc.realisedGain + perf.realisedGain,
      dividendsReceived: acc.dividendsReceived + perf.dividendsReceived,
      totalReturn: acc.totalReturn + perf.totalReturn,
    }),
    {
      currentMarketValue: 0,
      totalInvested: 0,
      unrealisedGain: 0,
      realisedGain: 0,
      dividendsReceived: 0,
      totalReturn: 0,
    }
  )
  const totalReturnPct =
    totals.totalInvested > 0
      ? (totals.totalReturn / totals.totalInvested) * 100
      : 0

  // Aggregate open holdings across all portfolios
  interface AggHolding {
    ticker: string
    qty: number
    totalCostBasis: number
    currentPrice: number | null
    currentValue: number | null
    unrealisedGain: number | null
  }

  const holdingAgg = new Map<string, AggHolding>()
  for (const perf of performances) {
    for (const h of perf.holdings) {
      if (!holdingAgg.has(h.ticker)) {
        holdingAgg.set(h.ticker, {
          ticker: h.ticker,
          qty: 0,
          totalCostBasis: 0,
          currentPrice: h.currentPrice,
          currentValue: null,
          unrealisedGain: null,
        })
      }
      const agg = holdingAgg.get(h.ticker)!
      agg.qty += h.quantity
      agg.totalCostBasis += h.totalCostBasis
      agg.currentPrice = h.currentPrice
    }
  }
  // Compute aggregated value/gain
  const aggregatedHoldings: (AggHolding & { avgCost: number; unrealisedPct: number | null })[] = []
  for (const agg of holdingAgg.values()) {
    const currentValue =
      agg.currentPrice !== null ? agg.qty * agg.currentPrice : null
    const unrealisedGain =
      currentValue !== null ? currentValue - agg.totalCostBasis : null
    const unrealisedPct =
      unrealisedGain !== null && agg.totalCostBasis > 0
        ? (unrealisedGain / agg.totalCostBasis) * 100
        : null
    aggregatedHoldings.push({
      ...agg,
      avgCost: agg.qty > 0 ? agg.totalCostBasis / agg.qty : 0,
      currentValue,
      unrealisedGain,
      unrealisedPct,
    })
  }
  aggregatedHoldings.sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Portfolio Performance
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">All portfolios · Current prices</p>
      </div>

      {/* Top-level summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Market Value
          </p>
          <p className="text-lg font-bold mt-1 text-gray-900 dark:text-white">
            {formatCurrency(totals.currentMarketValue, 'AUD')}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Invested
          </p>
          <p className="text-lg font-bold mt-1 text-gray-900 dark:text-white">
            {formatCurrency(totals.totalInvested, 'AUD')}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Unrealised Gain
          </p>
          <p className={`text-lg font-bold mt-1 ${gainClass(totals.unrealisedGain)}`}>
            {formatCurrency(totals.unrealisedGain, 'AUD')}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Realised Gain
          </p>
          <p className={`text-lg font-bold mt-1 ${gainClass(totals.realisedGain)}`}>
            {formatCurrency(totals.realisedGain, 'AUD')}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Dividends
          </p>
          <p className="text-lg font-bold mt-1 text-indigo-600">
            {formatCurrency(totals.dividendsReceived, 'AUD')}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Total Return
          </p>
          <p className={`text-lg font-bold mt-1 ${gainClass(totals.totalReturn)}`}>
            {formatCurrency(totals.totalReturn, 'AUD')}
          </p>
          <p className={`text-xs mt-0.5 font-medium ${gainClass(totalReturnPct)}`}>
            {formatPercent(totalReturnPct)}
          </p>
        </Card>
      </div>

      {/* Per-portfolio table */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">By Portfolio</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-6 pb-3 pt-4 font-medium">Portfolio</th>
                <th className="pb-3 pt-4 pr-6 font-medium text-right">Value</th>
                <th className="pb-3 pt-4 pr-6 font-medium text-right">Invested</th>
                <th className="pb-3 pt-4 pr-6 font-medium text-right">Unrealised Gain</th>
                <th className="pb-3 pt-4 pr-6 font-medium text-right">Realised Gain</th>
                <th className="pb-3 pt-4 pr-6 font-medium text-right">Dividends</th>
                <th className="pb-3 pt-4 pr-6 font-medium text-right">Total Return</th>
                <th className="pb-3 pt-4 pr-6 font-medium text-right">Return %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {performances.map((perf) => (
                <tr
                  key={perf.portfolioId}
                  className="hover:bg-gray-50 dark:hover:bg-slate-700/30"
                >
                  <td className="py-3 px-6 font-medium text-gray-900 dark:text-white">
                    {perf.portfolioName}
                  </td>
                  <td className="py-3 pr-6 text-right text-gray-700 dark:text-slate-300">
                    {formatCurrency(perf.currentMarketValue, 'AUD')}
                  </td>
                  <td className="py-3 pr-6 text-right text-gray-700 dark:text-slate-300">
                    {formatCurrency(perf.totalInvested, 'AUD')}
                  </td>
                  <td className={`py-3 pr-6 text-right font-medium ${gainClass(perf.unrealisedGain)}`}>
                    {formatCurrency(perf.unrealisedGain, 'AUD')}
                  </td>
                  <td className={`py-3 pr-6 text-right font-medium ${gainClass(perf.realisedGain)}`}>
                    {formatCurrency(perf.realisedGain, 'AUD')}
                  </td>
                  <td className="py-3 pr-6 text-right text-indigo-600">
                    {formatCurrency(perf.dividendsReceived, 'AUD')}
                  </td>
                  <td className={`py-3 pr-6 text-right font-medium ${gainClass(perf.totalReturn)}`}>
                    {formatCurrency(perf.totalReturn, 'AUD')}
                  </td>
                  <td className={`py-3 pr-6 text-right font-medium ${gainClass(perf.totalReturnPct)}`}>
                    {formatPercent(perf.totalReturnPct)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/60">
                <td className="py-3 px-6 font-semibold text-gray-900 dark:text-white">
                  Total
                </td>
                <td className="py-3 pr-6 text-right font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(totals.currentMarketValue, 'AUD')}
                </td>
                <td className="py-3 pr-6 text-right font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(totals.totalInvested, 'AUD')}
                </td>
                <td className={`py-3 pr-6 text-right font-bold ${gainClass(totals.unrealisedGain)}`}>
                  {formatCurrency(totals.unrealisedGain, 'AUD')}
                </td>
                <td className={`py-3 pr-6 text-right font-bold ${gainClass(totals.realisedGain)}`}>
                  {formatCurrency(totals.realisedGain, 'AUD')}
                </td>
                <td className="py-3 pr-6 text-right font-semibold text-indigo-600">
                  {formatCurrency(totals.dividendsReceived, 'AUD')}
                </td>
                <td className={`py-3 pr-6 text-right font-bold ${gainClass(totals.totalReturn)}`}>
                  {formatCurrency(totals.totalReturn, 'AUD')}
                </td>
                <td className={`py-3 pr-6 text-right font-bold ${gainClass(totalReturnPct)}`}>
                  {formatPercent(totalReturnPct)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Term Deposits */}
      {tdPerformances.length > 0 && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Term Deposits</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 pb-3 pt-4 font-medium">Name</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Principal</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Current Value</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Accrued Interest</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {tdPerformances.map((td) => (
                  <tr key={td.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-6 font-medium text-gray-900 dark:text-white">{td.name}</td>
                    <td className="py-3 pr-6 text-right text-gray-700 dark:text-slate-300">{formatCurrency(td.principal, 'AUD')}</td>
                    <td className="py-3 pr-6 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(td.currentValue, 'AUD')}</td>
                    <td className={`py-3 pr-6 text-right font-medium ${gainClass(td.accruedInterest)}`}>{formatCurrency(td.accruedInterest, 'AUD')}</td>
                    <td className="py-3 pr-6 text-right text-gray-700 dark:text-slate-300">{td.rate}% p.a.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Open Holdings aggregated */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Open Holdings</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {aggregatedHoldings.length} position{aggregatedHoldings.length !== 1 ? 's' : ''}{' '}
            aggregated across all portfolios
          </p>
        </div>
        <div className="overflow-x-auto">
          {aggregatedHoldings.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center px-6">No open holdings.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 pb-3 pt-4 font-medium">Ticker</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Qty</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Avg Cost</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Current Price</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Value</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Unrealised Gain</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Unrealised %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {aggregatedHoldings.map((h) => (
                  <tr
                    key={h.ticker}
                    className="hover:bg-gray-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="py-3 px-6 font-semibold text-gray-900 dark:text-white">
                      {h.ticker}
                    </td>
                    <td className="py-3 pr-6 text-right text-gray-700 dark:text-slate-300">
                      {formatNumber(h.qty, h.qty % 1 === 0 ? 0 : 4)}
                    </td>
                    <td className="py-3 pr-6 text-right text-gray-700 dark:text-slate-300">
                      {formatCurrency(h.avgCost, 'AUD')}
                    </td>
                    <td className="py-3 pr-6 text-right text-gray-700 dark:text-slate-300">
                      {h.currentPrice !== null ? formatCurrency(h.currentPrice, 'AUD') : '—'}
                    </td>
                    <td className="py-3 pr-6 text-right font-medium text-gray-900 dark:text-white">
                      {h.currentValue !== null ? formatCurrency(h.currentValue, 'AUD') : '—'}
                    </td>
                    <td className={`py-3 pr-6 text-right font-medium ${gainClass(h.unrealisedGain)}`}>
                      {h.unrealisedGain !== null ? formatCurrency(h.unrealisedGain, 'AUD') : '—'}
                    </td>
                    <td className={`py-3 pr-6 text-right font-medium ${gainClass(h.unrealisedPct)}`}>
                      {h.unrealisedPct !== null ? formatPercent(h.unrealisedPct) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}
