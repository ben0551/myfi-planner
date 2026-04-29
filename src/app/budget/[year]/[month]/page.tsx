import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import { computeBudgetSummary, type BudgetGroup, GROUP_LABELS, BUDGET_GROUPS } from '@/lib/budget'
import { MonthNavigator } from '@/components/budget/MonthNavigator'
import { BudgetEntryForm } from '@/components/budget/BudgetEntryForm'
import { BudgetVsActualChart } from '@/components/budget/BudgetVsActualChart'
import { SpendingBreakdownChart } from '@/components/budget/SpendingBreakdownChart'
import { BudgetTrendChart } from '@/components/budget/BudgetTrendChart'

export const dynamic = 'force-dynamic'

export default async function BudgetMonthPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { year: y, month: m } = await params
  const year = parseInt(y)
  const month = parseInt(m)

  const userId = session.user.id

  const categoryCount = await prisma.budgetCategory.count({ where: { userId, isActive: true } })
  if (categoryCount === 0) redirect('/budget/setup')

  const [categories, budgets, actuals] = await Promise.all([
    prisma.budgetCategory.findMany({
      where: { userId, isActive: true },
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.budget.findMany({ where: { userId, year, month } }),
    prisma.budgetActual.findMany({ where: { userId, year, month } }),
  ])

  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.amount]))
  const actualMap = new Map(actuals.map((a) => [a.categoryId, { amount: a.amount, notes: a.notes }]))

  const rows = categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    group: c.group as BudgetGroup,
    icon: c.icon,
    budgeted: budgetMap.get(c.id) ?? 0,
    actual: actualMap.get(c.id)?.amount ?? 0,
    notes: actualMap.get(c.id)?.notes ?? null,
  }))

  const summary = computeBudgetSummary(rows)
  const expenseRows = rows.filter((r) => r.group !== 'INCOME')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/budget" className="hover:text-indigo-600">Budget</Link>
            <span>/</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <MonthNavigator year={year} month={month} />
          <Link
            href="/budget/categories"
            className="text-sm text-indigo-600 hover:underline"
          >
            Manage categories
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Income (actual)</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(summary.totalIncomeActual)}</p>
          <p className="text-xs text-gray-400 mt-0.5">of {formatCurrency(summary.totalIncomeBudgeted)} budgeted</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Expenses (actual)</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalExpenseActual)}</p>
          <p className="text-xs text-gray-400 mt-0.5">of {formatCurrency(summary.totalExpenseBudgeted)} budgeted</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Surplus / Deficit</p>
          <p className={`text-xl font-bold ${summary.surplus >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {summary.surplus >= 0 ? '+' : ''}{formatCurrency(summary.surplus)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">income minus expenses</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Budget variance</p>
          {(() => {
            const variance = summary.totalExpenseBudgeted - summary.totalExpenseActual
            return (
              <>
                <p className={`text-xl font-bold ${variance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {variance >= 0 ? 'Under ' : 'Over '}{formatCurrency(Math.abs(variance))}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">vs expense budget</p>
              </>
            )
          })()}
        </Card>
      </div>

      {/* Charts */}
      {expenseRows.some((r) => r.budgeted > 0 || r.actual > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Budget vs Actual (expenses)</h2>
              <BudgetVsActualChart rows={expenseRows} />
            </Card>
          </div>
          <div>
            <Card>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Spending by group</h2>
              <SpendingBreakdownChart groups={summary.groups} />
            </Card>
          </div>
        </div>
      )}

      {/* Entry form */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Enter budget &amp; actuals</h2>
          <span className="text-xs text-gray-400">Amounts in AUD</span>
        </div>
        <BudgetEntryForm year={year} month={month} initialRows={rows} />
      </Card>

      {/* Trend */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">12-month trend</h2>
        <BudgetTrendChart />
      </Card>
    </div>
  )
}
