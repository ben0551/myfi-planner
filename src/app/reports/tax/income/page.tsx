import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  computeDividendReport,
  availableFYs,
  currentFY,
  getFYLabel,
} from '@/lib/tax'
import { Card } from '@/components/ui/Card'
import { TaxDisclaimer } from '@/components/tax/TaxDisclaimer'
import { FYSelector } from '@/components/tax/FYSelector'
import { DividendStackedChart } from '@/components/tax/DividendStackedChart'
import { formatCurrency, formatDate } from '@/lib/formatters'

export const dynamic = 'force-dynamic'

export default async function ReportsTaxIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id
  const { fy } = await searchParams
  const fyYear = fy ? parseInt(fy, 10) : currentFY()

  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    include: { transactions: { orderBy: { date: 'asc' } } },
  })

  const allTransactions = portfolios.flatMap((p) => p.transactions)
  const txToPortfolio = new Map(
    portfolios.flatMap((p) => p.transactions.map((t) => [t.id, p.name]))
  )

  const report = computeDividendReport(allTransactions, fyYear)
  const allFYs = availableFYs(allTransactions)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Taxable Income</h1>
          <p className="text-sm text-gray-500 mt-0.5">{getFYLabel(fyYear)} · All portfolios</p>
        </div>
        <FYSelector
          availableFYs={allFYs}
          currentFY={fyYear}
          basePath="/reports/tax/income"
        />
      </div>

      <TaxDisclaimer />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Cash Dividends
          </p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {formatCurrency(report.totalCash, 'AUD')}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Amount received</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Franking Credits
          </p>
          <p className="text-2xl font-bold mt-1 text-indigo-600">
            {report.totalFrankingCredits > 0
              ? formatCurrency(report.totalFrankingCredits, 'AUD')
              : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Offset against tax payable</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Grossed-Up Total
          </p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {formatCurrency(report.totalGrossedUp, 'AUD')}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Assessable income</p>
        </Card>
      </div>

      {/* Franking note */}
      {report.totalFrankingCredits > 0 && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-900/40 px-4 py-3 text-sm text-indigo-700 dark:text-indigo-300">
          Franking credits of{' '}
          <strong>{formatCurrency(report.totalFrankingCredits, 'AUD')}</strong> offset your
          income tax. If your marginal rate generates less tax than the credit, the excess is
          refundable. Calculated at 30% corporate tax rate.
        </div>
      )}

      {/* DRP note */}
      <div className="rounded-lg border border-amber-100 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        Dividend Reinvestment Plan (DRP) shares are included as assessable dividend income at
        the reinvestment amount.
      </div>

      {/* Stacked bar chart */}
      {report.byTicker.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">
            Income by Ticker
          </h2>
          <DividendStackedChart byTicker={report.byTicker} currency="AUD" />
        </Card>
      )}

      {/* Table with Portfolio column */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Dividend &amp; DRP Income
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {report.events.length} payment{report.events.length !== 1 ? 's' : ''} · All
            portfolios
          </p>
        </div>
        <div className="p-6">
          {report.events.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              No dividend income in this financial year.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-3 pr-4 font-medium">Ticker</th>
                    <th className="pb-3 pr-4 font-medium">Portfolio</th>
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium text-right">Cash Dividend</th>
                    <th className="pb-3 pr-4 font-medium text-right">Franking %</th>
                    <th className="pb-3 pr-4 font-medium text-right">Franking Credit</th>
                    <th className="pb-3 font-medium text-right">Grossed-Up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {report.events.map((e) => (
                    <tr
                      key={e.txId}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700/30"
                    >
                      <td className="py-3 pr-4 font-semibold text-gray-900 dark:text-white">
                        {e.ticker}
                      </td>
                      <td className="py-3 pr-4 text-gray-500 dark:text-slate-400 text-xs">
                        {txToPortfolio.get(e.txId) ?? '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-slate-400">
                        {formatDate(e.date, 'short')}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                        {formatCurrency(e.cashDividend, 'AUD')}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-500 dark:text-slate-400">
                        {e.frankingPct > 0 ? `${e.frankingPct}%` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right text-indigo-600">
                        {e.frankingCredit > 0
                          ? formatCurrency(e.frankingCredit, 'AUD')
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(e.grossedUp, 'AUD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-slate-600">
                    <td colSpan={3} className="py-3 pr-4 text-sm font-semibold text-gray-700 dark:text-slate-300">
                      Total
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(report.totalCash, 'AUD')}
                    </td>
                    <td className="py-3 pr-4" />
                    <td className="py-3 pr-4 text-right font-semibold text-indigo-600">
                      {report.totalFrankingCredits > 0
                        ? formatCurrency(report.totalFrankingCredits, 'AUD')
                        : '—'}
                    </td>
                    <td className="py-3 text-right font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(report.totalGrossedUp, 'AUD')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
