import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeCGTReport, computeDividendReport, availableFYs, currentFY, getFYLabel } from '@/lib/tax'
import { Card } from '@/components/ui/Card'
import { TaxDisclaimer } from '@/components/tax/TaxDisclaimer'
import { FYSelector } from '@/components/tax/FYSelector'
import { MarginalRateSelector } from '@/components/tax/MarginalRateSelector'
import { BackfillFrankingButton } from '@/components/tax/BackfillFrankingButton'
import { formatCurrency, gainClass } from '@/lib/formatters'

export const dynamic = 'force-dynamic'

export default async function TaxSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string; rate?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { fy, rate } = await searchParams

  const fyYear = fy ? parseInt(fy, 10) : currentFY()
  const marginalRate = rate ? parseFloat(rate) : 47
  const fyLabel = getFYLabel(fyYear)

  const fyStart = new Date(Date.UTC(fyYear - 1, 6, 1))
  const fyEnd   = new Date(Date.UTC(fyYear, 5, 30, 23, 59, 59))

  const [portfolios, soldProperties] = await Promise.all([
    prisma.portfolio.findMany({
      where: { userId: session.user.id },
      include: { transactions: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.property.findMany({
      where: {
        userId: session.user.id,
        type: 'INVESTMENT',
        soldDate: { gte: fyStart, lte: fyEnd },
        salePrice: { not: null },
      },
    }),
  ])

  // Collect all transactions across all portfolios to determine available FYs
  const allTransactions = portfolios.flatMap((p) => p.transactions)
  const allFYs = availableFYs(allTransactions)

  // Compute per-portfolio and aggregate
  const perPortfolio = portfolios
    .filter((p) => p.transactions.length > 0)
    .map((p) => {
      const cgt = computeCGTReport(p.transactions, fyYear)
      const div = computeDividendReport(p.transactions, fyYear)
      return { portfolio: p, cgt, div }
    })

  const currency = portfolios[0]?.currency ?? 'AUD'

  // Property CGT for this FY
  const propertyEvents = soldProperties.map((p) => {
    const salePrice  = p.salePrice!
    const costBase   = p.costBase ?? p.purchasePrice
    const grossGain  = salePrice - costBase
    const heldDays   = Math.round((p.soldDate!.getTime() - p.purchaseDate.getTime()) / 86400000)
    const eligible   = heldDays >= 365 && grossGain > 0
    return { grossGain, discountApplied: eligible ? grossGain * 0.5 : 0, assessable: eligible ? grossGain * 0.5 : grossGain }
  })
  const propGrossGain       = propertyEvents.reduce((s, e) => s + (e.grossGain > 0 ? e.grossGain : 0), 0)
  const propCapitalLosses   = propertyEvents.reduce((s, e) => s + (e.grossGain < 0 ? Math.abs(e.grossGain) : 0), 0)
  const propDiscountApplied = propertyEvents.reduce((s, e) => s + e.discountApplied, 0)
  const propNetAssessable   = propertyEvents.reduce((s, e) => s + e.assessable, 0)

  const agg = {
    grossGain:        perPortfolio.reduce((s, r) => s + r.cgt.totalGrossGain, 0) + propGrossGain,
    discountApplied:  perPortfolio.reduce((s, r) => s + r.cgt.totalDiscountApplied, 0) + propDiscountApplied,
    capitalLosses:    perPortfolio.reduce((s, r) => s + r.cgt.totalCapitalLosses, 0) + propCapitalLosses,
    netAssessableGain: perPortfolio.reduce((s, r) => s + r.cgt.netAssessableGain, 0) + propNetAssessable,
    cashDividends:    perPortfolio.reduce((s, r) => s + r.div.totalCash, 0),
    frankingCredits:  perPortfolio.reduce((s, r) => s + r.div.totalFrankingCredits, 0),
    grossedUp:        perPortfolio.reduce((s, r) => s + r.div.totalGrossedUp, 0),
  }
  const totalAssessable = agg.netAssessableGain + agg.grossedUp

  // Estimated dividend tax liability at chosen marginal rate
  const divTaxGross    = agg.grossedUp * (marginalRate / 100)
  const divNetTax      = divTaxGross - agg.frankingCredits   // may be negative (refund)
  const frankingRefund = divNetTax < 0 ? Math.abs(divNetTax) : 0
  const divTaxPayable  = Math.max(0, divNetTax)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tax Summary</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{fyLabel} · All portfolios</p>
        </div>
        <div className="flex items-center gap-2">
          <FYSelector availableFYs={allFYs} currentFY={fyYear} basePath="/tax" />
          <a
            href={`/api/tax/pdf?fy=${fyYear}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export PDF
          </a>
        </div>
      </div>

      <TaxDisclaimer />

      {allTransactions.length === 0 && (
        <Card>
          <p className="text-center text-gray-500 py-8 text-sm">No transactions recorded yet.</p>
        </Card>
      )}

      {allTransactions.length > 0 && (
        <>
          {/* CGT summary */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Capital Gains Tax
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Gross Gains</p>
                <p className={`text-xl font-bold mt-1 ${gainClass(agg.grossGain)}`}>
                  {formatCurrency(agg.grossGain, currency)}
                </p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">50% Discount</p>
                <p className="text-xl font-bold mt-1 text-green-600">
                  {agg.discountApplied > 0 ? formatCurrency(-agg.discountApplied, currency) : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Assets held &gt;12 months</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Capital Losses</p>
                <p className="text-xl font-bold mt-1 text-red-600">
                  {agg.capitalLosses > 0 ? formatCurrency(-agg.capitalLosses, currency) : '—'}
                </p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Net Assessable</p>
                <p className={`text-xl font-bold mt-1 ${gainClass(agg.netAssessableGain)}`}>
                  {formatCurrency(agg.netAssessableGain, currency)}
                </p>
              </Card>
            </div>
          </div>

          {/* Dividend summary */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Dividend Income
              </h2>
              {agg.cashDividends > 0 && agg.frankingCredits === 0 && <BackfillFrankingButton />}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Cash Dividends</p>
                <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                  {formatCurrency(agg.cashDividends, currency)}
                </p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Franking Credits</p>
                <p className="text-2xl font-bold mt-1 text-indigo-600">
                  {agg.frankingCredits > 0 ? formatCurrency(agg.frankingCredits, currency) : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Offset against tax payable</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Grossed-Up Total</p>
                <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                  {formatCurrency(agg.grossedUp, currency)}
                </p>
              </Card>
            </div>
          </div>

          {/* Estimated dividend tax liability */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Estimated Dividend Tax Liability
              </h2>
              <MarginalRateSelector currentRate={marginalRate} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Grossed-Up Income</p>
                <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
                  {formatCurrency(agg.grossedUp, currency)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Cash + franking credits</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Tax at {marginalRate}%</p>
                <p className="text-xl font-bold mt-1 text-red-600">
                  {formatCurrency(divTaxGross, currency)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Before franking offset</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Franking Offset</p>
                <p className="text-xl font-bold mt-1 text-emerald-600">
                  {agg.frankingCredits > 0 ? `−${formatCurrency(agg.frankingCredits, currency)}` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Credit against tax payable</p>
              </Card>
              <Card className={frankingRefund > 0 ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'}>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  {frankingRefund > 0 ? 'Franking Refund' : 'Net Tax Payable'}
                </p>
                <p className={`text-xl font-bold mt-1 ${frankingRefund > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {frankingRefund > 0
                    ? formatCurrency(frankingRefund, currency)
                    : formatCurrency(divTaxPayable, currency)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {frankingRefund > 0 ? 'Excess franking credit refunded' : 'Estimated liability'}
                </p>
              </Card>
            </div>
          </div>

          {/* Total assessable income */}
          <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                  Total Assessable Income — {fyLabel}
                </p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                  Net CGT gain + grossed-up dividend income
                </p>
              </div>
              <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">
                {formatCurrency(totalAssessable, currency)}
              </p>
            </div>
            {agg.frankingCredits > 0 && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-3 border-t border-indigo-200 dark:border-indigo-700 pt-3">
                Plus {formatCurrency(agg.frankingCredits, currency)} franking credits offset against your income tax.
                If your marginal rate generates less tax than the credit, the excess is refundable.
              </p>
            )}
          </Card>

          {/* Per-portfolio breakdown */}
          {perPortfolio.length > 1 && (
            <Card padding={false}>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">By Portfolio</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {perPortfolio.map(({ portfolio: p, cgt, div }) => (
                  <div key={p.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{p.name}</p>
                      <div className="flex gap-4 mt-1 text-xs text-gray-500 dark:text-slate-400">
                        <span>CGT: <span className={gainClass(cgt.netAssessableGain)}>{formatCurrency(cgt.netAssessableGain, p.currency)}</span></span>
                        <span>Dividends: {formatCurrency(div.totalGrossedUp, p.currency)} grossed-up</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link
                        href={`/portfolios/${p.id}/tax/cgt?fy=${fyYear}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                      >
                        CGT detail →
                      </Link>
                      <Link
                        href={`/portfolios/${p.id}/tax/dividends?fy=${fyYear}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                      >
                        Dividends →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {perPortfolio.length === 1 && (
            <div className="flex gap-3 text-sm">
              <Link
                href={`/portfolios/${perPortfolio[0].portfolio.id}/tax/cgt?fy=${fyYear}`}
                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                → CGT disposal events
              </Link>
              <Link
                href={`/portfolios/${perPortfolio[0].portfolio.id}/tax/dividends?fy=${fyYear}`}
                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                → Dividend detail
              </Link>
            </div>
          )}

          {/* Tax-loss harvesting */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Tax-Loss Harvesting
              </h2>
              <Link
                href={`/tax/harvest?fy=${fyYear}`}
                className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
              >
                Full analysis →
              </Link>
            </div>
            <Card>
              <p className="text-sm text-gray-700 dark:text-slate-300">
                Identify positions at an unrealised loss that could be sold before 30 June to offset your{' '}
                <strong>{formatCurrency(agg.netAssessableGain, currency)}</strong> net assessable capital gain.
              </p>
              <Link
                href={`/tax/harvest?fy=${fyYear}`}
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
              >
                View harvest opportunities →
              </Link>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
