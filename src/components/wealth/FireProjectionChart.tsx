'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  month: number
  value: number
  withoutContributions: number
}

interface Props {
  series: DataPoint[]
  fireNumber: number
  currency?: string
}

function formatCompact(value: number, currency: string) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatFull(value: number, currency: string) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

interface TooltipPayload {
  name: string
  value: number
  color: string
}

function CustomTooltip({
  active,
  payload,
  label,
  fireNumber,
  currency,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: number
  fireNumber: number
  currency: string
}) {
  if (!active || !payload?.length) return null
  const year = label != null ? (label / 12).toFixed(1) : '0'
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">Year {year}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatFull(p.value, currency)}
        </p>
      ))}
      <p className="text-red-500 mt-1">
        FIRE target: {formatFull(fireNumber, currency)}
      </p>
    </div>
  )
}

export function FireProjectionChart({ series, fireNumber, currency = 'AUD' }: Props) {
  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No projection data available
      </div>
    )
  }

  const tickFormatter = (month: number) => `Yr ${Math.round(month / 12)}`

  const yFormatter = (value: number) => formatCompact(value, currency)

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={series} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="colorNoContrib" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#9ca3af" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="month"
          tickFormatter={tickFormatter}
          tick={{ fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis tickFormatter={yFormatter} tick={{ fontSize: 12 }} width={75} />
        <Tooltip
          content={
            <CustomTooltip fireNumber={fireNumber} currency={currency} />
          }
        />
        <Legend
          formatter={(value) => (
            <span className="text-sm text-gray-600">{value}</span>
          )}
        />
        <ReferenceLine
          y={fireNumber}
          stroke="#ef4444"
          strokeDasharray="6 3"
          label={{ value: 'FIRE', fill: '#ef4444', fontSize: 12, position: 'right' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          name="With contributions"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#colorValue)"
        />
        <Area
          type="monotone"
          dataKey="withoutContributions"
          name="Without contributions"
          stroke="#9ca3af"
          strokeWidth={2}
          strokeDasharray="5 3"
          fill="url(#colorNoContrib)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
