'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Slice {
  name: string
  value: number
  pct: number
}

interface Props {
  data: Slice[]
  currency: string
  emptyMessage?: string
}

// Enough distinct colors for 10+ slices
const COLORS = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
  '#84cc16', '#06b6d4',
]

function fmtFull(v: number, currency: string) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}

interface TooltipProps {
  active?: boolean
  payload?: { name: string; value: number; payload: Slice }[]
  currency: string
}

function CustomTooltip({ active, payload, currency }: TooltipProps) {
  if (!active || !payload?.length) return null
  const s = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-800 mb-1">{s.name}</p>
      <p className="text-gray-600">{fmtFull(s.value, currency)}</p>
      <p className="text-gray-500">{s.pct.toFixed(1)}%</p>
    </div>
  )
}

export function AllocationDonutChart({ data, currency, emptyMessage = 'No data' }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          dataKey="value"
          nameKey="name"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <Legend
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, entry: any) => (
            <span className="text-xs text-gray-700">
              {value} <span className="text-gray-400">{entry.payload?.pct.toFixed(1)}%</span>
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
