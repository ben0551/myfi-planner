import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/formatters'
import { computeNetWorth, WealthSnapshot } from '@/lib/wealth'
import { NetWorthHistoryChart } from '@/components/wealth/NetWorthHistoryChart'
import { PortfolioCard } from '@/components/portfolio/PortfolioCard'
import { recordNetWorthSnapshot } from '@/lib/netWorthSnapshot'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id
  const isAdmin = session.user.role === 'ADMIN'

  const [
    portfolios,
    properties,
    superAccounts,
    cashAccounts,
    fireSettings,
    inheritances,
    pendingCount,
    budgetWidget,
  ] = await Promise.all([
    prisma.portfolio.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { transactions: true } } },
    }),
    prisma.property.findMany({ where: { userId, soldDate: null }, include: { mortgage: true } }),
    prisma.superAccount.findMany({ where: { userId } }),
    prisma.cashAccount.findMany({ where: { userId } }),
    prisma.fireSettings.findUnique({ where: { userId } }),
    prisma.anticipatedInheritance.findMany({ where: { userId }, orderBy: { expectedYear: 'asc' } }),
    prisma.pendingTransaction.count({
      where: { status: 'PENDING', ...(isAdmin ? {} : { userId }) },
    }),
    (async () => {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const [catCount, budgetAgg, actualAgg] = await Promise.all([
        prisma.budgetCategory.count({ where: { userId, isActive: true } }),
        prisma.budget.aggregate({ where: { userId, year, month }, _sum: { amount: true } }),
        prisma.budgetActual.aggregate({ where: { userId, year, month }, _sum: { amount: true } }),
      ])
      if (catCount === 0) return null
      return {
        year, month,
        budgeted: budgetAgg._sum.amount ?? 0,
        actual: actualAgg._sum.amount ?? 0,
        hasCategories: catCount > 0,
      }
    })(),
  ])

  const portfolioIds = portfolios.map((p) => p.id)

  const [latestSnapshots, goals] = await Promise.all([
    prisma.portfolioSnapshot.findMany({
      where: { portfolioId: { in: portfolioIds } },
      orderBy: { date: 'desc' },
      distinct: ['portfolioId'],
    }),
    prisma.goal.findMany({
      where: { portfolioId: { in: portfolioIds } },
      orderBy: { targetDate: 'asc' },
      include: { portfolio: { select: { id: true, name: true, currency: true } } },
    }),
  ])

  const snapshotMap = new Map(latestSnapshots.map((s) => [s.portfolioId, s]))

  // ── Wealth totals ──────────────────────────────────────────────────────────
  const portfolioTypeMap = new Map(portfolios.map((p) => [p.id, p.portfolioType]))
  const sharesValue = latestSnapshots.reduce((s, snap) => portfolioTypeMap.get(snap.portfolioId) !== 'TERM_DEPOSIT' ? s + snap.value : s, 0)
  const tdValue     = latestSnapshots.reduce((s, snap) => portfolioTypeMap.get(snap.portfolioId) === 'TERM_DEPOSIT'  ? s + snap.value : s, 0)
  const propertyGrossValue = properties.reduce((s, p) => s + p.currentValue * (p.ownershipPct / 100), 0)
  const totalMortgages = properties.reduce((s, p) => s + (p.mortgage?.currentBalance ?? 0), 0)
  const propertyEquity = propertyGrossValue - totalMortgages
  const superBalance = superAccounts.reduce((s, a) => s + a.currentBalance, 0)
  const cashBalance = cashAccounts.reduce((s, a) => s + a.balance, 0)

  const totalAssets = sharesValue + tdValue + propertyGrossValue + superBalance + cashBalance
  const totalLiabilities = totalMortgages

  const snap: WealthSnapshot = {
    sharesValue, tdValue, propertyEquity, superBalance, cashBalance,
    propertyDebt: totalMortgages, propertyGrossValue,
  }
  const settings = fireSettings ?? { includePropertyEquity: true, includeSuper: true, includeCash: true }
  const netWorth = computeNetWorth(snap, settings)

  const fireNumber = (fireSettings && fireSettings.withdrawalRate > 0 && fireSettings.annualExpenses > 0)
    ? fireSettings.annualExpenses / (fireSettings.withdrawalRate / 100)
    : null
  const fireProgress = fireNumber ? Math.min(100, (netWorth / fireNumber) * 100) : null

  void recordNetWorthSnapshot(userId, {
    totalAssets, totalLiabilities, netWorth,
    sharesValue, tdValue, propertyValue: propertyGrossValue, superBalance, cashBalance,
  })

  // ── Goals progress ─────────────────────────────────────────────────────────
  const goalsWithProgress = goals.map((g) => {
    const snap = snapshotMap.get(g.portfolioId)
    const current = snap ? (g.type === 'CONTRIBUTION' ? snap.invested : snap.value) : 0
    const pct = g.targetValue > 0 ? Math.min(100, (current / g.targetValue) * 100) : 0
    const daysLeft = g.targetDate ? Math.ceil((g.targetDate.getTime() - Date.now()) / 86400000) : null
    return { ...g, current, pct, daysLeft }
  })
  const activeGoals = goalsWithProgress.filter((g) => g.pct < 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <Link href="/email-import">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800 text-sm font-medium">
                ⚠ {pendingCount} pending import{pendingCount !== 1 ? 's' : ''}
              </span>
            </Link>
          )}
          <Link href="/wealth/properties"><Button variant="secondary" size="sm">+ Property</Button></Link>
          <Link href="/wealth/super"><Button variant="secondary" size="sm">+ Super</Button></Link>
          <Link href="/portfolios/new"><Button size="sm">+ Portfolio</Button></Link>
        </div>
      </div>

      {/* Net worth hero */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-6">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Net Worth</p>
            <p className="text-4xl font-bold text-gray-900">{formatCurrency(netWorth)}</p>
          </div>
          {fireProgress !== null && (
            <div className="sm:w-64">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>FIRE progress</span>
                <Link href="/wealth/fire" className="text-indigo-600 hover:underline">
                  {fireProgress.toFixed(1)}% of {formatCurrency(fireNumber!)}
                </Link>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${fireProgress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile label="Total Assets" value={formatCurrency(totalAssets)} />
        <StatTile label="Total Debt" value={formatCurrency(totalLiabilities)} valueClass="text-red-600" />
        {fireSettings ? (
          <StatTile label="Monthly Savings" value={formatCurrency(fireSettings.monthlySavings)} valueClass="text-indigo-700" />
        ) : (
          <StatTile label="Portfolios" value={String(portfolios.length)} valueClass="text-indigo-700" />
        )}
        <StatTile
          label="Active Goals"
          value={String(activeGoals.length)}
          valueClass="text-amber-700"
          sub={goalsWithProgress.length > activeGoals.length ? `${goalsWithProgress.length - activeGoals.length} complete` : undefined}
        />
      </div>

      {/* Net worth history */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Net Worth History</h2>
          <Link href="/wealth" className="text-xs text-indigo-500 hover:underline">Full wealth view →</Link>
        </div>
        <NetWorthHistoryChart />
      </div>

      {/* Portfolios */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Investment Portfolios
          </h2>
          <Link href="/portfolios" className="text-xs text-indigo-500 hover:underline">All portfolios →</Link>
        </div>
        {portfolios.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-12 text-center text-gray-500">
            <p className="text-sm font-medium">No portfolios yet</p>
            <p className="text-xs mt-1 mb-4">Create your first portfolio to start tracking.</p>
            <Link href="/portfolios/new"><Button>Create Portfolio</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {portfolios.map((p) => (
              <PortfolioCard
                key={p.id}
                id={p.id}
                name={p.name}
                description={p.description}
                currency={p.currency}
                transactionCount={p._count.transactions}
              />
            ))}
          </div>
        )}
      </div>

      {/* Goals */}
      {goalsWithProgress.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Goals</h2>
            <span className="text-xs text-gray-400">
              {activeGoals.length} active · {goalsWithProgress.length - activeGoals.length} complete
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {goalsWithProgress.slice(0, 5).map((g) => (
              <Link
                key={g.id}
                href={`/portfolios/${g.portfolioId}/goals`}
                className="block px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600">{g.name}</p>
                    <p className="text-xs text-gray-400">{g.portfolio.name}</p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{g.pct.toFixed(0)}%</p>
                    <p className="text-xs text-gray-400">
                      {formatCurrency(g.current, g.portfolio.currency)} / {formatCurrency(g.targetValue, g.portfolio.currency)}
                      {g.daysLeft !== null && (
                        <span className={g.daysLeft < 0 && g.pct < 100 ? ' text-red-400' : ''}>
                          {' · '}{g.daysLeft < 0 ? `${Math.abs(g.daysLeft)}d overdue` : `${g.daysLeft}d left`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${g.pct >= 100 ? 'bg-emerald-500' : g.daysLeft !== null && g.daysLeft < 0 ? 'bg-red-400' : 'bg-indigo-500'}`}
                    style={{ width: `${g.pct}%` }}
                  />
                </div>
              </Link>
            ))}
            {goalsWithProgress.length > 5 && (
              <div className="px-5 py-3 text-xs text-gray-400 text-center">
                +{goalsWithProgress.length - 5} more goals
              </div>
            )}
          </div>
        </div>
      )}

      {/* Budget widget */}
      {budgetWidget ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Budget — this month</h2>
            <Link href="/budget" className="text-xs text-indigo-500 hover:underline">View budget →</Link>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-xs text-gray-400">Budgeted</p>
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{formatCurrency(budgetWidget.budgeted)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Actual</p>
              <p className={`text-lg font-bold ${budgetWidget.actual > budgetWidget.budgeted && budgetWidget.budgeted > 0 ? 'text-red-600' : 'text-gray-900 dark:text-slate-100'}`}>
                {formatCurrency(budgetWidget.actual)}
              </p>
            </div>
            {budgetWidget.budgeted > 0 && (
              <div className="flex-1 min-w-[120px]">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{Math.round((budgetWidget.actual / budgetWidget.budgeted) * 100)}% spent</span>
                  <span className={budgetWidget.actual > budgetWidget.budgeted ? 'text-red-500' : 'text-emerald-600'}>
                    {budgetWidget.actual > budgetWidget.budgeted ? 'Over' : 'Under'} by {formatCurrency(Math.abs(budgetWidget.budgeted - budgetWidget.actual))}
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${budgetWidget.actual > budgetWidget.budgeted ? 'bg-red-400' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.min(100, (budgetWidget.actual / budgetWidget.budgeted) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-600 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Set up your budget</p>
            <p className="text-xs text-gray-500 mt-0.5">Track income and expenses with Australian default categories.</p>
          </div>
          <Link href="/budget/setup"><Button size="sm" variant="secondary">Get started →</Button></Link>
        </div>
      )}

      {/* FIRE prompt */}
      {!fireSettings && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-900">Set up your FIRE planner</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              Enter your target annual spend to see how far you are from financial independence.
            </p>
          </div>
          <Link href="/wealth/fire"><Button size="sm">Get started →</Button></Link>
        </div>
      )}
    </div>
  )
}

function StatTile({
  label, value, valueClass = 'text-gray-900', sub,
}: {
  label: string
  value: string
  valueClass?: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

