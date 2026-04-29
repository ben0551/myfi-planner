'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/formatters'

interface Goal {
  id: string
  name: string
  type: string
  targetValue: number
  targetDate: Date | null
  notes: string | null
}

interface Props {
  goal: Goal
  currentValue: number
  currency: string
  portfolioId: string
}

export function GoalCard({ goal, currentValue, currency, portfolioId }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const pct = Math.min((currentValue / goal.targetValue) * 100, 100)
  const remaining = Math.max(goal.targetValue - currentValue, 0)
  const achieved = currentValue >= goal.targetValue

  // Days remaining
  let daysRemaining: number | null = null
  let overdue = false
  if (goal.targetDate) {
    const ms = new Date(goal.targetDate).getTime() - Date.now()
    daysRemaining = Math.ceil(ms / (1000 * 60 * 60 * 24))
    overdue = daysRemaining < 0
  }

  async function handleDelete() {
    if (!confirm(`Delete goal "${goal.name}"?`)) return
    setDeleting(true)
    await fetch(`/api/portfolios/${portfolioId}/goals/${goal.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{goal.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              goal.type === 'CONTRIBUTION'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-indigo-100 text-indigo-700'
            }`}>
              {goal.type === 'CONTRIBUTION' ? 'Contribution' : 'Portfolio Value'}
            </span>
            {achieved && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                Achieved
              </span>
            )}
          </div>

          {goal.notes && (
            <p className="text-sm text-gray-500 mt-1">{goal.notes}</p>
          )}

          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                {formatCurrency(currentValue, currency)} of {formatCurrency(goal.targetValue, currency)}
              </span>
              <span className={`font-medium ${achieved ? 'text-green-600' : 'text-gray-900'}`}>
                {pct.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${achieved ? 'bg-green-500' : 'bg-indigo-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{achieved ? 'Goal reached!' : `${formatCurrency(remaining, currency)} to go`}</span>
              {goal.targetDate && (
                <span className={overdue && !achieved ? 'text-red-500' : ''}>
                  {overdue && !achieved
                    ? `${Math.abs(daysRemaining!)} days overdue`
                    : daysRemaining === 0
                    ? 'Due today'
                    : `${daysRemaining} days left · ${formatDate(goal.targetDate, 'medium')}`}
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? '...' : 'Delete'}
        </Button>
      </div>
    </Card>
  )
}
