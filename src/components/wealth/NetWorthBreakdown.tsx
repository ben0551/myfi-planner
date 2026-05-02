'use client'

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface Props {
  sharesValue: number
  tdValue: number
  propertyEquity: number
  superBalance: number
  cashBalance: number
  currency?: string
}

const SLICES = [
  { key: 'sharesValue',   label: 'Shares',         color: '#6366f1' },
  { key: 'tdValue',       label: 'Term Deposits',  color: '#0ea5e9' },
  { key: 'propertyEquity', label: 'Property Equity', color: '#10b981' },
  { key: 'superBalance',  label: 'Super',          color: '#f59e0b' },
  { key: 'cashBalance',   label: 'Cash',           color: '#a78bfa' },
] as const

function formatCompact(value: number, currency: string) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function NetWorthBreakdown({
  sharesValue,
  tdValue,
  propertyEquity,
  superBalance,
  cashBalance,
  currency = 'AUD',
}: Props) {
  const values: Record<string, number> = {
    sharesValue,
    tdValue,
    propertyEquity,
    superBalance,
    cashBalance,
  }

  const data = SLICES.filter((s) => values[s.key] > 0).map((s) => ({
    name: s.label,
    value: values[s.key],
    color: s.color,
  }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No data to display
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={65}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [
            formatCompact(Number(value), currency),
            undefined,
          ]}
        />
        <Legend
          formatter={(value) => (
            <span className="text-sm text-gray-600">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
