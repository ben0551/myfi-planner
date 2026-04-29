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
