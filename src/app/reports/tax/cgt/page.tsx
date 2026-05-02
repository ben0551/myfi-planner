import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  computeCGTReport,
  availableFYs,
  currentFY,
  getFYLabel,
} from '@/lib/tax'
import { buildHoldings } from '@/lib/calculations'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { Card } from '@/components/ui/Card'
import { TaxDisclaimer } from '@/components/tax/TaxDisclaimer'
import { FYSelector } from '@/components/tax/FYSelector'
import { CGTBarChart } from '@/components/tax/CGTBarChart'
import { formatCurrency, formatDate, formatNumber, gainClass } from '@/lib/formatters'

function fyDateRange(fyYear: number) {
  return {
    start: new Date(Date.UTC(fyYear - 1, 6, 1)),  // 1 Jul of prior year
    end: new Date(Date.UTC(fyYear, 5, 30, 23, 59, 59)),  // 30 Jun of fyYear
  }
}

export const dynamic = 'force-dynamic'

export default async function ReportsCGTPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id
  const { fy } = await searchParams
  const fyYear = fy ? parseInt(fy, 10) : currentFY()

  const { start: fyStart, end: fyEnd } = fyDateRange(fyYear)

  const [portfolios, soldProperties] = await Promise.all([
    prisma.portfolio.findMany({
      where: { userId },
      include: { transactions: { orderBy: { date: 'asc' } } },
    }),
    prisma.property.findMany({
      where: {
        userId,
        type: 'INVESTMENT',
        soldDate: { gte: fyStart, lte: fyEnd },
        salePrice: { not: null },
      },
    }),
  ])

  const allTransactions = portfolios.flatMap((p) => p.transactions)
  const txToPortfolio = new Map(
    portfolios.flatMap((p) => p.transactions.map((t) => [t.id, p.name]))
  )

  const report = computeCGTReport(allTransactions, fyYear)
  const allFYs = availableFYs(allTransactions)

  // Compute property CGT events
  const propertyGainEvents = soldProperties.map((p) => {
    const salePrice = p.salePrice!
    const costBase = p.costBase ?? p.purchasePrice
    const grossGain = salePrice - costBase
    const heldDays = Math.round((p.soldDate!.getTime() - p.purchaseDate.getTime()) / 86400000)
    const discountEligible = heldDays >= 365 && grossGain > 0
    const assessableGain = discountEligible ? grossGain * 0.5 : grossGain
    return { id: p.id, name: p.name, soldDate: p.soldDate!, purchaseDate: p.purchaseDate, salePrice, costBase, grossGain, heldDays, discountEligible, assessableGain }
  })
  const propertyGrossGain       = propertyGainEvents.reduce((s, e) => s + (e.grossGain > 0 ? e.grossGain : 0), 0)
  const propertyCapitalLosses   = propertyGainEvents.reduce((s, e) => s + (e.grossGain < 0 ? Math.abs(e.grossGain) : 0), 0)
  const propertyDiscountApplied = propertyGainEvents.reduce((s, e) => s + (e.discountEligible ? e.grossGain * 0.5 : 0), 0)
  const propertyNetGain         = propertyGainEvents.reduce((s, e) => s + e.assessableGain, 0)

  const combinedGrossGain        = report.totalGrossGain + propertyGrossGain
  const combinedCapitalLosses    = report.totalCapitalLosses + propertyCapitalLosses
  const combinedDiscountApplied  = report.totalDiscountApplied + propertyDiscountApplied
  const combinedNetAssessableGain = report.netAssessableGain + propertyNetGain

  // ── CGT Harvesting Opportunities ────────────────────────────────────────────
  const harvestCandidates: {
    ticker: string
    portfolioName: string
    qty: number
    avgCost: number
    currentPrice: number | null
    unrealisedGain: number
  }[] = []

  if (combinedNetAssessableGain > 0) {
    // Collect all unique tickers across portfolios
    const allTickers = [
      ...new Set(allTransactions.map((t) => t.ticker.toUpperCase())),
    ]
    const priceMap = await getCachedAsxQuotes(allTickers)

    for (const portfolio of portfolios) {
      const holdings = buildHoldings(portfolio.transactions, priceMap)
      for (const h of holdings) {
        if (h.unrealisedGain !== null && h.unrealisedGain < 0) {
          harvestCandidates.push({
            ticker: h.ticker,
            portfolioName: portfolio.name,
            qty: h.quantity,
            avgCost: h.avgCost,
            currentPrice: h.currentPrice,
            unrealisedGain: h.unrealisedGain,
          })
        }
      }
    }
    // Sort by most negative first
    harvestCandidates.sort((a, b) => a.unrealisedGain - b.unrealisedGain)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Capital Gains Tax
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{getFYLabel(fyYear)} · All portfolios</p>
        </div>
        <FYSelector
          availableFYs={allFYs}
          currentFY={fyYear}
          basePath="/reports/tax/cgt"
        />
      </div>

      <TaxDisclaimer />

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Gross Capital Gains
          </p>
          <p className={`text-xl font-bold mt-1 ${gainClass(combinedGrossGain)}`}>
            {formatCurrency(combinedGrossGain, 'AUD')}
          </p>
          {propertyGrossGain > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">incl. {formatCurrency(propertyGrossGain, 'AUD')} property</p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            50% Discount Applied
          </p>
          <p className="text-xl font-bold mt-1 text-green-600">
            {combinedDiscountApplied > 0
              ? formatCurrency(-combinedDiscountApplied, 'AUD')
              : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Assets held &gt;12 months</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Capital Losses
          </p>
          <p className="text-xl font-bold mt-1 text-red-600">
            {combinedCapitalLosses > 0
              ? formatCurrency(-combinedCapitalLosses, 'AUD')
              : '—'}
          </p>
          {propertyCapitalLosses > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">incl. {formatCurrency(propertyCapitalLosses, 'AUD')} property</p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Net Assessable Gain
          </p>
          <p className={`text-xl font-bold mt-1 ${gainClass(combinedNetAssessableGain)}`}>
            {formatCurrency(combinedNetAssessableGain, 'AUD')}
          </p>
          {propertyNetGain !== 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              incl. {formatCurrency(propertyNetGain, 'AUD')} property
            </p>
          )}
          {report.netLossCarriedForward > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {formatCurrency(report.netLossCarriedForward, 'AUD')} loss carried forward
            </p>
          )}
        </Card>
      </div>

      {/* CGT Harvesting Opportunities */}
      {combinedNetAssessableGain > 0 && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              CGT Harvesting Opportunities
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Positions with unrealised losses that could offset your{' '}
              {formatCurrency(combinedNetAssessableGain, 'AUD')} assessable gain
            </p>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              These positions have unrealised losses that could be crystallised to reduce your
              assessable capital gain. Note: this analysis only covers tracked share portfolios
              — other CGT events (property sales, crypto, etc.) may also affect your position.
            </p>

            {harvestCandidates.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                No unrealised losses identified in current holdings.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="pb-3 pr-4 font-medium">Ticker</th>
                      <th className="pb-3 pr-4 font-medium">Portfolio</th>
                      <th className="pb-3 pr-4 font-medium text-right">Qty</th>
                      <th className="pb-3 pr-4 font-medium text-right">Avg Cost</th>
                      <th className="pb-3 pr-4 font-medium text-right">Current Price</th>
                      <th className="pb-3 font-medium text-right">Unrealised Loss</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {harvestCandidates.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                        <td className="py-3 pr-4 font-semibold text-gray-900 dark:text-white">
                          {c.ticker}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-slate-400">
                          {c.portfolioName}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                          {formatNumber(c.qty, 0)}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                          {formatCurrency(c.avgCost, 'AUD')}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                          {c.currentPrice !== null ? formatCurrency(c.currentPrice, 'AUD') : '—'}
                        </td>
                        <td className="py-3 text-right font-medium text-red-600">
                          {formatCurrency(c.unrealisedGain, 'AUD')}
                          <span className="ml-1.5 text-xs text-gray-400 font-normal">
                            up to 50% CGT discount may apply
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Property Sales */}
      {propertyGainEvents.length > 0 && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Property Disposals</h2>
            <p className="text-xs text-gray-500 mt-0.5">Investment properties sold in {getFYLabel(fyYear)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 pb-3 pt-4 font-medium">Property</th>
                  <th className="pb-3 pt-4 pr-6 font-medium">Sold</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Sale Price</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Cost Base</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Gross Gain</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Held</th>
                  <th className="pb-3 pt-4 pr-6 font-medium text-right">Assessable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {propertyGainEvents.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-6 font-medium text-gray-900 dark:text-white">{e.name}</td>
                    <td className="py-3 pr-6 text-gray-600 dark:text-slate-400">{formatDate(e.soldDate, 'short')}</td>
                    <td className="py-3 pr-6 text-right text-gray-700 dark:text-slate-300">{formatCurrency(e.salePrice, 'AUD')}</td>
                    <td className="py-3 pr-6 text-right text-gray-700 dark:text-slate-300">{formatCurrency(e.costBase, 'AUD')}</td>
                    <td className={`py-3 pr-6 text-right font-medium ${gainClass(e.grossGain)}`}>{formatCurrency(e.grossGain, 'AUD')}</td>
                    <td className="py-3 pr-6 text-right text-gray-500 dark:text-slate-400">
                      {Math.floor(e.heldDays / 365)}y {Math.floor((e.heldDays % 365) / 30)}m
                      {e.discountEligible && (
                        <span className="ml-1.5 inline-block rounded bg-green-100 px-1 py-0.5 text-xs text-green-700">50%</span>
                      )}
                    </td>
                    <td className={`py-3 pr-6 text-right font-medium ${gainClass(e.assessableGain)}`}>{formatCurrency(e.assessableGain, 'AUD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Other CGT assets note */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900/40 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
        This report covers share portfolios and tracked investment property disposals. Crypto and other CGT
        assets may also contribute to your total CGT liability for {getFYLabel(fyYear)}.
      </div>

      {/* Bar chart */}
      {report.events.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">
            Assessable Gain by Ticker
          </h2>
          <CGTBarChart events={report.events} currency="AUD" />
        </Card>
      )}

      {/* Events table with Portfolio column */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Disposal Events</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {report.events.length} event{report.events.length !== 1 ? 's' : ''} · Average
            cost basis · All portfolios
          </p>
        </div>
        <div className="p-6">
          {report.events.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              No disposal events in this financial year.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-3 pr-4 font-medium">Ticker</th>
                    <th className="pb-3 pr-4 font-medium">Portfolio</th>
                    <th className="pb-3 pr-4 font-medium">Sell Date</th>
                    <th className="pb-3 pr-4 font-medium text-right">Qty</th>
                    <th className="pb-3 pr-4 font-medium text-right">Proceeds</th>
                    <th className="pb-3 pr-4 font-medium text-right">Cost Base</th>
                    <th className="pb-3 pr-4 font-medium text-right">Gross Gain</th>
                    <th className="pb-3 pr-4 font-medium">Acquired</th>
                    <th className="pb-3 pr-4 font-medium text-right">Held</th>
                    <th className="pb-3 font-medium text-right">Assessable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {report.events.map((e) => (
                    <tr
                      key={e.sellTxId}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700/30"
                    >
                      <td className="py-3 pr-4 font-semibold text-gray-900 dark:text-white">
                        {e.ticker}
                      </td>
                      <td className="py-3 pr-4 text-gray-500 dark:text-slate-400 text-xs">
                        {txToPortfolio.get(e.sellTxId) ?? '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-slate-400">
                        {formatDate(e.sellDate, 'short')}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                        {formatNumber(e.qty, 0)}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                        {formatCurrency(e.proceeds, 'AUD')}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                        {formatCurrency(e.costBase, 'AUD')}
                      </td>
                      <td className={`py-3 pr-4 text-right font-medium ${gainClass(e.grossGain)}`}>
                        {formatCurrency(e.grossGain, 'AUD')}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-slate-400">
                        {e.acquisitionDate ? formatDate(e.acquisitionDate, 'short') : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-500 dark:text-slate-400">
                        {e.holdingDays}d
                        {e.discountEligible && (
                          <span className="ml-1 inline-block rounded bg-green-100 px-1 py-0.5 text-xs text-green-700">
                            50%
                          </span>
                        )}
                      </td>
                      <td className={`py-3 text-right font-medium ${gainClass(e.assessableGain)}`}>
                        {formatCurrency(e.assessableGain, 'AUD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
