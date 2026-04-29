'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

export interface ValuePoint {
  date: string   // YYYY-MM-DD
  value: number
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
}

function fmtCurrency(v: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(v)
}

interface TooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  currency: string
  valueLabel: string
}

function CustomTooltip({ active, payload, label, currency, valueLabel }: TooltipProps) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{fmtDate(label)}</p>
      <p className="text-gray-500">{valueLabel}</p>
      <p className="font-medium text-gray-900">{fmtCurrency(payload[0].value, currency)}</p>
    </div>
  )
}

interface Props {
  history: ValuePoint[]
  currency?: string
  color?: string        // hex or tailwind-compatible stroke color
  fillId?: string       // unique gradient id to avoid conflicts
  valueLabel?: string
  /** Optional reference line (e.g. purchase price) */
  referenceLine?: { value: number; label: string; color?: string }
}

export function AssetValueChart({
  history,
  currency = 'AUD',
  color = '#4f46e5',
  fillId = 'gradAsset',
  valueLabel = 'Value',
  referenceLine,
}: Props) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No value history yet. Record the first valuation below.
      </p>
    )
  }

  if (history.length === 1) {
    return (
      <div className="text-center py-8">
        <p className="text-2xl font-bold" style={{ color }}>{fmtCurrency(history[0].value, currency)}</p>
        <p className="text-xs text-gray-400 mt-1">as of {fmtDate(history[0].date)}</p>
        <p className="text-xs text-gray-400 mt-4">Chart appears after the second valuation entry.</p>
      </div>
    )
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  const min = Math.min(...sorted.map((p) => p.value))
  const max = Math.max(...sorted.map((p) => p.value))
  const padding = (max - min) * 0.1
  const yMin = Math.max(0, Math.floor((min - padding) / 10000) * 10000)

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={sorted} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[yMin, 'auto']}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          width={60}
        />
        <Tooltip content={<CustomTooltip currency={currency} valueLabel={valueLabel} />} />
        {referenceLine && (
          <ReferenceLine
            y={referenceLine.value}
            stroke={referenceLine.color ?? '#9ca3af'}
            strokeDasharray="4 3"
            label={{
              value: referenceLine.label,
              position: 'insideTopLeft',
              fontSize: 10,
              fill: referenceLine.color ?? '#9ca3af',
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${fillId})`}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
