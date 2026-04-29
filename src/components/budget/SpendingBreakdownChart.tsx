'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { type BudgetGroupSummary, GROUP_COLORS, type BudgetGroup } from '@/lib/budget'
import { formatCurrency } from '@/lib/formatters'

interface Props {
  groups: BudgetGroupSummary[]
  currency?: string
}

export function SpendingBreakdownChart({ groups, currency = 'AUD' }: Props) {
  const data = groups
    .filter((g) => g.group !== 'INCOME' && g.actual > 0)
    .map((g) => ({
      name: g.label,
      value: g.actual,
      color: GROUP_COLORS[g.group as BudgetGroup] ?? '#94a3b8',
    }))

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No spending data yet</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatCurrency(Number(value), currency)}
          contentStyle={{ borderRadius: 12, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
