'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { DividendByTicker } from '@/lib/tax'

interface DividendStackedChartProps {
  byTicker: DividendByTicker[]
  currency: string
}

function fmt(v: number, currency: string) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1,
  }).format(v)
}

function fmtFull(v: number, currency: string) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(v)
}

interface TooltipProps {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  currency: string
}

function CustomTooltip({ active, payload, label, currency }: TooltipProps) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-gray-800">{fmtFull(p.value, currency)}</span>
        </div>
      ))}
    </div>
  )
}

export function DividendStackedChart({ byTicker, currency }: DividendStackedChartProps) {
  if (byTicker.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={byTicker} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="ticker" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis
          tickFormatter={(v) => fmt(v, currency)}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          width={72}
        />
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="cashTotal" name="Cash Dividends" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} />
        <Bar dataKey="frankingCreditTotal" name="Franking Credits" stackId="a" fill="#818cf8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
