import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  availableFYs,
  currentFY,
  getFYBounds,
  getFYLabel,
} from '@/lib/tax'
import { Card } from '@/components/ui/Card'
import { FYSelector } from '@/components/tax/FYSelector'
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters'

export const dynamic = 'force-dynamic'

type TxType = 'BUY' | 'SELL' | 'DIVIDEND' | 'DRP'

const typeBadge: Record<TxType, string> = {
  BUY:      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  SELL:     'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  DIVIDEND: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  DRP:      'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
}

export default async function ReportsAllTradesPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id
  const { fy } = await searchParams
  const fyYear = fy ? parseInt(fy, 10) : currentFY()
  const { start, end } = getFYBounds(fyYear)

  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    include: {
      transactions: {
        where: {
          date: { gte: start, lte: end },
        },
        orderBy: { date: 'asc' },
      },
    },
  })

  const allTransactions = portfolios.flatMap((p) =>
    p.transactions.map((t) => ({ ...t, portfolioName: p.name }))
  )
  const allFYs = availableFYs(
    portfolios.flatMap((p) => p.transactions)
  )

  // Summary counts
  const buyCount = allTransactions.filter((t) => t.type === 'BUY').length
  const sellCount = allTransactions.filter((t) => t.type === 'SELL').length
  const dividendCount = allTransactions.filter((t) => t.type === 'DIVIDEND').length
  const drpCount = allTransactions.filter((t) => t.type === 'DRP').length

  const totalProceeds = allTransactions
    .filter((t) => t.type === 'SELL')
    .reduce((s, t) => s + t.quantity.toNumber() * t.price.toNumber() - t.fees.toNumber(), 0)

  const totalInvested = allTransactions
    .filter((t) => t.type === 'BUY')
    .reduce((s, t) => s + t.quantity.toNumber() * t.price.toNumber() + t.fees.toNumber(), 0)

  const totalDividends = allTransactions
    .filter((t) => t.type === 'DIVIDEND' || t.type === 'DRP')
    .reduce((s, t) => {
      if (t.type === 'DIVIDEND') return s + (t.amount?.toNumber() ?? 0)
      // DRP: use amount if set, else qty * price
      return s + (t.amount?.toNumber() ?? t.quantity.toNumber() * t.price.toNumber())
    }, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Trades</h1>
          <p className="text-sm text-gray-500 mt-0.5">{getFYLabel(fyYear)} · All portfolios</p>
        </div>
        <FYSelector
          availableFYs={allFYs}
          currentFY={fyYear}
          basePath="/reports/tax/all-trades"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Buy / Sell / Div / DRP
          </p>
          <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
            {buyCount} / {sellCount} / {dividendCount} / {drpCount}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {allTransactions.length} total transactions
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Total Proceeds
          </p>
          <p className="text-xl font-bold mt-1 text-green-600">
            {sellCount > 0 ? formatCurrency(totalProceeds, 'AUD') : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">From sell transactions</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Total Invested
          </p>
          <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
            {buyCount > 0 ? formatCurrency(totalInvested, 'AUD') : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">From buy transactions</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">
            Total Dividends
          </p>
          <p className="text-xl font-bold mt-1 text-indigo-600">
            {(dividendCount + drpCount) > 0 ? formatCurrency(totalDividends, 'AUD') : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Cash + DRP reinvestment</p>
        </Card>
      </div>

      {/* Trades table */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Transactions</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {allTransactions.length} transaction{allTransactions.length !== 1 ? 's' : ''} in{' '}
            {getFYLabel(fyYear)}
          </p>
        </div>
        <div className="p-6">
          {allTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              No transactions in this financial year.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Portfolio</th>
                    <th className="pb-3 pr-4 font-medium">Ticker</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium text-right">Qty</th>
                    <th className="pb-3 pr-4 font-medium text-right">Price</th>
                    <th className="pb-3 pr-4 font-medium text-right">Fees</th>
                    <th className="pb-3 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {allTransactions.map((t) => {
                    const type = t.type as TxType
                    const badgeClass = typeBadge[type] ?? typeBadge.BUY
                    const amount = t.amount?.toNumber() ?? null
                    const qty = t.quantity.toNumber()
                    const price = t.price.toNumber()
                    const fees = t.fees.toNumber()

                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-gray-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="py-3 pr-4 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(new Date(t.date), 'short')}
                        </td>
                        <td className="py-3 pr-4 text-gray-500 dark:text-slate-400 text-xs">
                          {t.portfolioName}
                        </td>
                        <td className="py-3 pr-4 font-semibold text-gray-900 dark:text-white">
                          {t.ticker.toUpperCase()}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                            {type}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                          {type === 'DIVIDEND' ? '—' : formatNumber(Math.abs(qty), qty % 1 === 0 ? 0 : 4)}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                          {type === 'DIVIDEND' ? '—' : formatCurrency(Math.abs(price), 'AUD')}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-500 dark:text-slate-400">
                          {fees > 0 ? formatCurrency(fees, 'AUD') : '—'}
                        </td>
                        <td className="py-3 pr-4 text-right font-medium text-gray-900 dark:text-white">
                          {amount !== null
                            ? formatCurrency(amount, 'AUD')
                            : formatCurrency(Math.abs(qty) * Math.abs(price), 'AUD')}
                        </td>
                        <td className="py-3 text-gray-400 text-xs">
                          {t.notes ?? ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
