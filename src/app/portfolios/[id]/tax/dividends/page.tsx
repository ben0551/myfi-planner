import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeDividendReport, availableFYs, currentFY } from '@/lib/tax'
import { Card } from '@/components/ui/Card'
import { TaxDisclaimer } from '@/components/tax/TaxDisclaimer'
import { FYSelector } from '@/components/tax/FYSelector'
import { DividendIncomeTable } from '@/components/tax/DividendIncomeTable'
import { DividendStackedChart } from '@/components/tax/DividendStackedChart'
import { formatCurrency } from '@/lib/formatters'

export const dynamic = 'force-dynamic'

export default async function DividendReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ fy?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const { fy } = await searchParams

  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
  })
  if (!portfolio) notFound()

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'asc' },
  })

  const fyYear = fy ? parseInt(fy, 10) : currentFY()
  const report = computeDividendReport(transactions, fyYear)
  const allFYs = availableFYs(transactions)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/portfolios/${id}/tax?fy=${fyYear}`}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← Tax Report
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold text-gray-900">Dividend Income</h1>
          <FYSelector availableFYs={allFYs} currentFY={fyYear} basePath={`/portfolios/${id}/tax/dividends`} />
        </div>
        <p className="text-sm text-gray-500 mt-1">{report.fyLabel}</p>
      </div>

      <TaxDisclaimer />

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Cash Dividends</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">
            {formatCurrency(report.totalCash, portfolio.currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Amount received</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Franking Credits</p>
          <p className="text-2xl font-bold mt-1 text-indigo-600">
            {report.totalFrankingCredits > 0
              ? formatCurrency(report.totalFrankingCredits, portfolio.currency)
              : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Offset against tax payable</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Grossed-Up Total</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">
            {formatCurrency(report.totalGrossedUp, portfolio.currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Assessable income</p>
        </Card>
      </div>

      {/* Franking note */}
      {report.totalFrankingCredits > 0 && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          Franking credits of <strong>{formatCurrency(report.totalFrankingCredits, portfolio.currency)}</strong> offset
          your income tax. If your marginal rate generates less tax than the credit, the excess is refundable.
          Calculated at 30% corporate tax rate.
        </div>
      )}

      {/* Stacked bar chart */}
      {report.byTicker.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Income by Ticker</h2>
          <DividendStackedChart byTicker={report.byTicker} currency={portfolio.currency} />
        </div>
      )}

      {/* Table */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Dividend Summary by Stock</h2>
          <p className="text-xs text-gray-500 mt-0.5">{report.events.length} payment{report.events.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="p-6">
          <DividendIncomeTable
            events={report.events}
            byTicker={report.byTicker}
            currency={portfolio.currency}
          />
        </div>
      </Card>
    </div>
  )
}
