import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeTaxSummary, availableFYs, currentFY } from '@/lib/tax'
import { Card } from '@/components/ui/Card'
import { TaxDisclaimer } from '@/components/tax/TaxDisclaimer'
import { FYSelector } from '@/components/tax/FYSelector'
import { formatCurrency, gainClass } from '@/lib/formatters'

export const dynamic = 'force-dynamic'

export default async function TaxPage({
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
  const summary = computeTaxSummary(transactions, fyYear)
  const allFYs = availableFYs(transactions)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href={`/portfolios/${id}`} className="text-sm text-indigo-600 hover:text-indigo-800">
          ← {portfolio.name}
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold text-gray-900">Tax Report</h1>
          <FYSelector availableFYs={allFYs} currentFY={fyYear} basePath={`/portfolios/${id}/tax`} />
        </div>
        <p className="text-sm text-gray-500 mt-1">{summary.fyLabel} · 1 Jul – 30 Jun</p>
      </div>

      <TaxDisclaimer />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Net Assessable CGT</p>
          <p className={`text-2xl font-bold mt-1 ${gainClass(summary.cgt.netAssessableGain)}`}>
            {formatCurrency(summary.cgt.netAssessableGain, portfolio.currency)}
          </p>
          {summary.cgt.totalDiscountApplied > 0 && (
            <p className="text-xs text-green-600 mt-0.5">
              {formatCurrency(summary.cgt.totalDiscountApplied, portfolio.currency)} discount applied
            </p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Capital Losses</p>
          <p className="text-2xl font-bold mt-1 text-red-600">
            {summary.cgt.totalCapitalLosses > 0
              ? formatCurrency(-summary.cgt.totalCapitalLosses, portfolio.currency)
              : '—'}
          </p>
          {summary.cgt.netLossCarriedForward > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {formatCurrency(summary.cgt.netLossCarriedForward, portfolio.currency)} carried forward
            </p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Grossed-Up Dividends</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">
            {summary.dividends.totalGrossedUp > 0
              ? formatCurrency(summary.dividends.totalGrossedUp, portfolio.currency)
              : '—'}
          </p>
          {summary.dividends.totalFrankingCredits > 0 && (
            <p className="text-xs text-indigo-600 mt-0.5">
              incl. {formatCurrency(summary.dividends.totalFrankingCredits, portfolio.currency)} franking
            </p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Assessable Income</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">
            {formatCurrency(summary.totalAssessableIncome, portfolio.currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">CGT + grossed-up dividends</p>
        </Card>
      </div>

      {/* Franking credits callout */}
      {summary.dividends.totalFrankingCredits > 0 && (
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Franking Credits</p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
              Tax offset available to claim — reduces your income tax payable for {summary.fyLabel}
            </p>
          </div>
          <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
            {formatCurrency(summary.dividends.totalFrankingCredits, portfolio.currency)}
          </p>
        </div>
      )}

      {/* CGT preview + Dividends preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Capital Gains Events</h2>
            <Link
              href={`/portfolios/${id}/tax/cgt?fy=${fyYear}`}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Full report →
            </Link>
          </div>
          {summary.cgt.events.length === 0 ? (
            <p className="text-sm text-gray-400">No disposal events this year.</p>
          ) : (
            <div className="space-y-2">
              {summary.cgt.events.slice(0, 5).map((e) => (
                <div key={e.sellTxId} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">{e.ticker}</span>
                  <span className={`font-medium ${gainClass(e.assessableGain)}`}>
                    {formatCurrency(e.assessableGain, portfolio.currency)}
                    {e.discountEligible && <span className="ml-1 text-xs text-green-600">✓ 50%</span>}
                  </span>
                </div>
              ))}
              {summary.cgt.events.length > 5 && (
                <p className="text-xs text-gray-400">+{summary.cgt.events.length - 5} more</p>
              )}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Dividend Income</h2>
            <Link
              href={`/portfolios/${id}/tax/dividends?fy=${fyYear}`}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Full report →
            </Link>
          </div>
          {summary.dividends.byTicker.length === 0 ? (
            <p className="text-sm text-gray-400">No dividends recorded this year.</p>
          ) : (
            <div className="space-y-2">
              {summary.dividends.byTicker.slice(0, 5).map((t) => (
                <div key={t.ticker} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">{t.ticker}</span>
                  <span className="text-gray-700">
                    {formatCurrency(t.grossedUpTotal, portfolio.currency)}
                    {t.frankingCreditTotal > 0 && (
                      <span className="ml-1 text-xs text-indigo-500">
                        +{formatCurrency(t.frankingCreditTotal, portfolio.currency)} franking
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {summary.dividends.byTicker.length > 5 && (
                <p className="text-xs text-gray-400">+{summary.dividends.byTicker.length - 5} more</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
