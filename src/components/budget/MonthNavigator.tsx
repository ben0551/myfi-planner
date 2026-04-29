'use client'

import { useRouter } from 'next/navigation'
import { formatBudgetPeriod } from '@/lib/budget'

interface Props {
  year: number
  month: number
}

export function MonthNavigator({ year, month }: Props) {
  const router = useRouter()
  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  function go(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    router.push(`/budget/${d.getFullYear()}/${d.getMonth() + 1}`)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => go(-1)}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500"
        title="Previous month"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <span className="text-base font-semibold text-gray-900 min-w-[140px] text-center">
        {formatBudgetPeriod(year, month)}
      </span>

      <button
        onClick={() => go(1)}
        disabled={isCurrentMonth}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Next month"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
