'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Line, ComposedChart,
} from 'recharts'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function fmt(v: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', maximumFractionDigits: 0,
  }).format(v)
}

interface TrendPoint {
  year: number
  month: number
  totalBudgeted: number
  totalActual: number
  totalIncomeActual: number
  byGroup: Record<string, number>
}

const GROUP_COLORS: Record<string, string> = {
  LIVING: '#6366f1',
  TRANSPORT: '#f59e0b',
  HEALTH: '#10b981',
  SAVINGS: '#3b82f6',
  OTHER: '#9ca3af',
}

const GROUP_LABELS: Record<string, string> = {
  LIVING: 'Living',
  TRANSPORT: 'Transport',
  HEALTH: 'Health',
  SAVINGS: 'Savings',
  OTHER: 'Other',
}

type Mode = 'totals' | 'stacked'

export function BudgetTrendChart() {
  const [mode, setMode] = useState<Mode>('totals')

  const { data = [] } = useSWR<TrendPoint[]>('/api/budget/summary?months=12', fetcher)

  const chartData = data.map((d) => ({
    label: new Date(d.year, d.month - 1, 1).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
    Budgeted: d.totalBudgeted,
    Actual: d.totalActual,
    Income: d.totalIncomeActual,
    ...d.byGroup,
  }))

  const isEmpty = chartData.every((d) => d.Budgeted === 0 && d.Actual === 0)

  // Collect all groups that appear in the data
  const allGroups = [...new Set(data.flatMap((d) => Object.keys(d.byGroup)))]

  if (isEmpty) {
    return <p className="text-sm text-gray-400 text-center py-8">No trend data yet</p>
  }

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex gap-1 mb-4">
        {(['totals', 'stacked'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              mode === m
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {m === 'totals' ? 'Budget vs Actual' : 'By Category'}
          </button>
        ))}
      </div>

      {mode === 'totals' ? (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} width={64} />
            <Tooltip
              formatter={(v, name) => [fmt(Number(v)), name]}
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Budgeted" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar dataKey="Actual" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Line
              type="monotone"
              dataKey="Income"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="Income (actual)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} width={64} />
            <Tooltip
              formatter={(v, name) => [fmt(Number(v)), GROUP_LABELS[String(name)] ?? String(name)]}
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
            />
            <Legend
              formatter={(value) => GROUP_LABELS[value] ?? value}
              wrapperStyle={{ fontSize: 12 }}
            />
            {allGroups.map((group) => (
              <Bar
                key={group}
                dataKey={group}
                stackId="spend"
                fill={GROUP_COLORS[group] ?? '#9ca3af'}
                radius={group === allGroups[allGroups.length - 1] ? [4, 4, 0, 0] : undefined}
                maxBarSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
