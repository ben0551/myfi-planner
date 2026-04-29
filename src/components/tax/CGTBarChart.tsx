'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import type { CGTEvent } from '@/lib/tax'

interface CGTBarChartProps {
  events: CGTEvent[]
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
  payload?: { value: number; payload: { ticker: string; assessableGain: number } }[]
  currency: string
}

function CustomTooltip({ active, payload, currency }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-800 mb-1">{d.ticker}</p>
      <p className={d.assessableGain >= 0 ? 'text-emerald-700' : 'text-red-600'}>
        Assessable: {fmtFull(d.assessableGain, currency)}
      </p>
    </div>
  )
}

export function CGTBarChart({ events, currency }: CGTBarChartProps) {
  if (events.length === 0) return null

  // Aggregate assessable gain by ticker
  const byTicker = new Map<string, number>()
  for (const e of events) {
    byTicker.set(e.ticker, (byTicker.get(e.ticker) ?? 0) + e.assessableGain)
  }
  const data = [...byTicker.entries()]
    .map(([ticker, assessableGain]) => ({ ticker, assessableGain }))
    .sort((a, b) => b.assessableGain - a.assessableGain)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="ticker" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis
          tickFormatter={(v) => fmt(v, currency)}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          width={72}
        />
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <ReferenceLine y={0} stroke="#e5e7eb" />
        <Bar dataKey="assessableGain" name="Assessable Gain" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.assessableGain >= 0 ? '#059669' : '#dc2626'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
