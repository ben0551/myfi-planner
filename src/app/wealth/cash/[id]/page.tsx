import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { CashAccountForm } from '@/components/wealth/CashAccountForm'
import { SuperBalanceChart } from '@/components/wealth/SuperBalanceChart'
import { SuperReconcileForm } from '@/components/wealth/SuperReconcileForm'
import { CashBalanceHistoryTable } from '@/components/wealth/CashBalanceHistoryTable'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CashDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params

  const account = await prisma.cashAccount.findUnique({
    where: { id },
    include: {
      balanceHistory: {
        orderBy: { date: 'desc' },
      },
    },
  })

  if (!account || account.userId !== session.user.id) notFound()

  const sortedHistory = [...account.balanceHistory].sort((a, b) =>
    a.date.toISOString().localeCompare(b.date.toISOString())
  )
  const firstEntry = sortedHistory[0]
  const growthAmount = firstEntry ? account.balance - firstEntry.balance : null
  const growthPct =
    firstEntry && firstEntry.balance > 0
      ? ((account.balance - firstEntry.balance) / firstEntry.balance) * 100
      : null

  const historyForChart = account.balanceHistory.map((h) => ({
    date: h.date.toISOString().split('T')[0],
    value: h.balance,
  }))

  const initialValues = {
    name: account.name,
    institution: account.institution ?? '',
    balance: account.balance.toString(),
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
          <Link href="/wealth/cash" className="hover:text-indigo-600">Cash</Link>
          <span>/</span>
          <span>{account.name}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
        {account.institution && (
          <p className="text-sm text-gray-500 mt-0.5">{account.institution}</p>
        )}
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current Balance</p>
          <p className="text-xl font-bold text-sky-700 mt-1">
            {formatCurrency(account.balance, account.currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">as of {formatDate(account.balanceUpdatedAt)}</p>
        </Card>
        {growthAmount !== null && (
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Change</p>
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
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Entries Recorded</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{account.balanceHistory.length}</p>
        </Card>
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
          <CashBalanceHistoryTable
            accountId={account.id}
            history={account.balanceHistory}
            currency={account.currency}
          />
        </Card>
      )}

      {/* Record Balance */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Record Balance</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter the current balance from your bank statement to track history and update the displayed value.
        </p>
        <SuperReconcileForm
          accountId={account.id}
          currentBalance={account.balance}
          currency={account.currency}
          apiPath={`/api/wealth/cash/${account.id}/balance`}
        />
      </Card>

      {/* Edit Account */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Account Details</h2>
        <CashAccountForm accountId={account.id} initialValues={initialValues} />
      </Card>
    </div>
  )
}
