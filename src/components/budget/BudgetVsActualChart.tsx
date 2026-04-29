'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { type BudgetRow } from '@/lib/budget'
import { formatCurrency } from '@/lib/formatters'

interface Props {
  rows: BudgetRow[]
  currency?: string
}

function CustomTooltip({ active, payload, label, currency }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  currency: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 dark:text-slate-200 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value, currency)}</p>
      ))}
    </div>
  )
}

export function BudgetVsActualChart({ rows, currency = 'AUD' }: Props) {
  const data = rows
    .filter((r) => r.budgeted > 0 || r.actual > 0)
    .map((r) => ({
      name: r.icon ? `${r.icon} ${r.name}` : r.name,
      Budgeted: r.budgeted,
      Actual: r.actual,
      over: r.actual > r.budgeted && r.budgeted > 0,
    }))

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No data to display</p>
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 120, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
        <XAxis
          type="number"
          tickFormatter={(v) => formatCurrency(v, currency)}
          tick={{ fontSize: 10 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          width={120}
        />
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Budgeted" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={14} />
        <Bar dataKey="Actual" radius={[0, 4, 4, 0]} maxBarSize={14}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.over ? '#ef4444' : '#10b981'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
