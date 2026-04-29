import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeCGTReport, availableFYs, currentFY } from '@/lib/tax'
import { Card } from '@/components/ui/Card'
import { TaxDisclaimer } from '@/components/tax/TaxDisclaimer'
import { FYSelector } from '@/components/tax/FYSelector'
import { CGTTable } from '@/components/tax/CGTTable'
import { CGTBarChart } from '@/components/tax/CGTBarChart'
import { formatCurrency, gainClass } from '@/lib/formatters'

export const dynamic = 'force-dynamic'

export default async function CGTReportPage({
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
  const report = computeCGTReport(transactions, fyYear)
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
          <h1 className="text-2xl font-bold text-gray-900">Capital Gains Tax</h1>
          <FYSelector availableFYs={allFYs} currentFY={fyYear} basePath={`/portfolios/${id}/tax/cgt`} />
        </div>
        <p className="text-sm text-gray-500 mt-1">{report.fyLabel}</p>
      </div>

      <TaxDisclaimer />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Gross Capital Gains</p>
          <p className={`text-xl font-bold mt-1 ${gainClass(report.totalGrossGain)}`}>
            {formatCurrency(report.totalGrossGain, portfolio.currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">50% Discount Applied</p>
          <p className="text-xl font-bold mt-1 text-green-600">
            {report.totalDiscountApplied > 0
              ? formatCurrency(-report.totalDiscountApplied, portfolio.currency)
              : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Assets held &gt;12 months</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Capital Losses</p>
          <p className="text-xl font-bold mt-1 text-red-600">
            {report.totalCapitalLosses > 0
              ? formatCurrency(-report.totalCapitalLosses, portfolio.currency)
              : '—'}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Net Assessable Gain</p>
          <p className={`text-xl font-bold mt-1 ${gainClass(report.netAssessableGain)}`}>
            {formatCurrency(report.netAssessableGain, portfolio.currency)}
          </p>
          {report.netLossCarriedForward > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {formatCurrency(report.netLossCarriedForward, portfolio.currency)} loss carried forward
            </p>
          )}
        </Card>
      </div>

      {/* Bar chart */}
      {report.events.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Assessable Gain by Ticker</h2>
          <CGTBarChart events={report.events} currency={portfolio.currency} />
        </div>
      )}

      {/* Events table */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Disposal Events</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {report.events.length} event{report.events.length !== 1 ? 's' : ''} · Average cost basis
          </p>
        </div>
        <div className="p-6">
          <CGTTable events={report.events} currency={portfolio.currency} />
        </div>
      </Card>
    </div>
  )
}
