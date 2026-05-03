import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { SuperAccountForm } from '@/components/wealth/SuperAccountForm'
import { SuperBalanceChart } from '@/components/wealth/SuperBalanceChart'
import { SuperReconcileForm } from '@/components/wealth/SuperReconcileForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SuperDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params

  const account = await prisma.superAccount.findUnique({
    where: { id },
    include: {
      balanceHistory: {
        orderBy: { date: 'desc' },
      },
    },
  })

  if (!account || account.userId !== session.user.id) notFound()

  // Compute growth from first to current balance
  const sortedHistory = [...account.balanceHistory].sort((a, b) =>
    a.date.toISOString().localeCompare(b.date.toISOString())
  )
  const firstEntry = sortedHistory[0]
  const growthAmount = firstEntry ? account.currentBalance - firstEntry.balance : null
  const growthPct =
    firstEntry && firstEntry.balance > 0
      ? ((account.currentBalance - firstEntry.balance) / firstEntry.balance) * 100
      : null

  // Year-on-year: last recorded balance per calendar year → compare successive years
  const balanceByYear = new Map<number, number>()
  for (const h of sortedHistory) {
    balanceByYear.set(h.date.getFullYear(), h.balance)
  }
  const yoyYears = Array.from(balanceByYear.keys()).sort()
  const yoyData = yoyYears.map((year, i) => {
    const balance = balanceByYear.get(year)!
    const prevBalance = i > 0 ? (balanceByYear.get(yoyYears[i - 1]) ?? null) : null
    return {
      year,
      balance,
      growthAmount: prevBalance !== null ? balance - prevBalance : null,
      growthPct:
        prevBalance !== null && prevBalance > 0
          ? ((balance - prevBalance) / prevBalance) * 100
          : null,
    }
  }).reverse()

  const historyForChart = account.balanceHistory.map((h) => ({
    date: h.date.toISOString().split('T')[0],
    value: h.balance,
  }))

  const initialValues = {
    fundName: account.fundName,
    accountNumber: account.accountNumber ?? '',
    currentBalance: account.currentBalance.toString(),
    employerContribPct: account.employerContribPct.toString(),
    employeeContribPct: account.employeeContribPct.toString(),
    currency: account.currency,
    notes: account.notes ?? '',
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/wealth" className="hover:text-indigo-600">Wealth</Link>
          <span>/</span>
          <Link href="/wealth/super" className="hover:text-indigo-600">Super</Link>
          <span>/</span>
          <span>{account.fundName}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{account.fundName}</h1>
        {account.accountNumber && (
          <p className="text-sm text-gray-500 mt-0.5">Account: {account.accountNumber}</p>
        )}
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current Balance</p>
          <p className="text-xl font-bold text-amber-700 mt-1">
            {formatCurrency(account.currentBalance, account.currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">as of {formatDate(account.balanceUpdatedAt)}</p>
        </Card>
        {growthAmount !== null && (
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Growth</p>
            <p className={`text-xl font-bold mt-1 ${growthAmount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {growthAmount >= 0 ? '+' : ''}{formatCurrency(growthAmount, account.currency)}
            </p>
            {growthPct !== null && (
              <p className="text-xs text-gray-400 mt-0.5">
                {growthPct >= 0 ? '+' : ''}{growthPct.toFixed(1)}% since first entry
              </p>
            )}
          </Card>
        )}
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Employer SGC</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{account.employerContribPct}%</p>
        </Card>
        {account.employeeContribPct > 0 && (
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Employee Contrib</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{account.employeeContribPct}%</p>
          </Card>
        )}
      </div>

      {/* Balance History Chart */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Balance History</h2>
        <SuperBalanceChart history={historyForChart} currency={account.currency} />
      </Card>

      {/* Year-on-Year Growth */}
      {yoyData.length > 1 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Year-on-Year Growth</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left pb-2 font-medium">Year</th>
                  <th className="text-right pb-2 font-medium">Year-end Balance</th>
                  <th className="text-right pb-2 font-medium">Growth ($)</th>
                  <th className="text-right pb-2 font-medium">Growth (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {yoyData.map((row) => {
                  const isCurrentYear = row.year === new Date().getFullYear()
                  return (
                    <tr key={row.year}>
                      <td className="py-2 text-gray-700 dark:text-slate-300">
                        {row.year}
                        {isCurrentYear && (
                          <span className="ml-1.5 text-xs text-gray-400">YTD</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(row.balance, account.currency)}
                      </td>
                      <td className={`py-2 text-right font-medium ${
                        row.growthAmount === null ? 'text-gray-400' :
                        row.growthAmount >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {row.growthAmount === null
                          ? '—'
                          : `${row.growthAmount >= 0 ? '+' : ''}${formatCurrency(row.growthAmount, account.currency)}`}
                      </td>
                      <td className={`py-2 text-right font-medium ${
                        row.growthPct === null ? 'text-gray-400' :
                        row.growthPct >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {row.growthPct === null
                          ? '—'
                          : `${row.growthPct >= 0 ? '+' : ''}${row.growthPct.toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Balance History Table */}
      {account.balanceHistory.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recorded Balances</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Change</th>
                </tr>
              </thead>
              <tbody>
                {account.balanceHistory.map((entry, i) => {
                  const prev = account.balanceHistory[i + 1]
                  const change = prev ? entry.balance - prev.balance : null
                  return (
                    <tr key={entry.id} className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">{formatDate(entry.date)}</td>
                      <td className="py-2 text-right font-medium text-gray-900">
                        {formatCurrency(entry.balance, account.currency)}
                      </td>
                      <td className={`py-2 text-right text-xs ${
                        change === null ? 'text-gray-400' :
                        change >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {change === null ? '—' : `${change >= 0 ? '+' : ''}${formatCurrency(change, account.currency)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Reconcile / Record Balance */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Record Balance</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter your current balance from your super fund statement. This updates both the
          current balance and the history chart.
        </p>
        <SuperReconcileForm
          accountId={account.id}
          currentBalance={account.currentBalance}
          currency={account.currency}
        />
      </Card>

      {/* Edit Account */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Account Details</h2>
        <SuperAccountForm accountId={account.id} initialValues={initialValues} />
      </Card>
    </div>
  )
}
