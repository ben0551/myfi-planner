import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { computePortfolioPerformance } from '@/lib/calculations'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { GoalCard } from '@/components/goals/GoalCard'
import { AddGoalForm } from '@/components/goals/AddGoalForm'

export const dynamic = 'force-dynamic'

export default async function GoalsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({ where: { id, userId: session.user.id } })
  if (!portfolio) notFound()

  const [transactions, goals] = await Promise.all([
    prisma.transaction.findMany({ where: { portfolioId: id }, orderBy: { date: 'asc' } }),
    prisma.goal.findMany({ where: { portfolioId: id }, orderBy: { createdAt: 'asc' } }),
  ])

  const tickers = [...new Set(transactions.map((t) => t.ticker.toUpperCase()))]
  const priceMap = await getCachedAsxQuotes(tickers)
  const performance = computePortfolioPerformance(
    portfolio.id, portfolio.name, portfolio.currency, transactions, priceMap
  )

  const currentValue = performance.currentMarketValue
  const totalContributed = performance.totalInvested

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/portfolios/${id}`} className="text-sm text-indigo-600 hover:text-indigo-800">
            ← {portfolio.name}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Goals</h1>
        </div>
      </div>

      {/* Current position summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Current Portfolio Value</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {new Intl.NumberFormat('en-AU', { style: 'currency', currency: portfolio.currency }).format(currentValue)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Contributed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {new Intl.NumberFormat('en-AU', { style: 'currency', currency: portfolio.currency }).format(totalContributed)}
          </p>
        </Card>
      </div>

      {/* Existing goals */}
      {goals.length > 0 ? (
        <div className="space-y-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              currentValue={goal.type === 'CONTRIBUTION' ? totalContributed : currentValue}
              currency={portfolio.currency}
              portfolioId={id}
            />
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-center text-gray-400 text-sm py-8">
            No goals yet. Add one below to start tracking your progress.
          </p>
        </Card>
      )}

      {/* Add goal form */}
      <Card>
        <h2 className="font-semibold text-gray-900 mb-4">Add Goal</h2>
        <AddGoalForm portfolioId={id} />
      </Card>
    </div>
  )
}
