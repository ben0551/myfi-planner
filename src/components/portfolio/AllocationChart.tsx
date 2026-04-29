'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import type { Holding } from '@/lib/types'

const COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#65a30d', '#0284c7', '#92400e',
]

interface AllocationChartProps {
  holdings: Holding[]
  currency: string
}

export function AllocationChart({ holdings, currency }: AllocationChartProps) {
  const data = holdings
    .filter((h) => h.currentValue != null && h.currentValue > 0)
    .map((h) => ({ name: h.ticker, value: h.currentValue! }))
    .sort((a, b) => b.value - a.value)

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
        No holdings with current prices
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `${formatCurrency(value, currency)} (${((value / total) * 100).toFixed(1)}%)`,
            name,
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 12, color: '#374151' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
