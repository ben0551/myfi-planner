'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Bucket {
  name: string
  value: number
  pct: number
}

interface Props {
  data: Bucket[]
  currency: string
}

const RISK_COLORS: Record<string, string> = {
  Defensive: '#10b981', // emerald
  Moderate:  '#4f46e5', // indigo
  Growth:    '#f59e0b', // amber
  Aggressive:'#ef4444', // red
  Unknown:   '#9ca3af', // gray
}

function fmtFull(v: number, currency: string) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}

interface TooltipProps {
  active?: boolean
  payload?: { value: number; payload: Bucket }[]
  currency: string
}

function CustomTooltip({ active, payload, currency }: TooltipProps) {
  if (!active || !payload?.length) return null
  const b = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-800 mb-1">{b.name}</p>
      <p className="text-gray-600">{fmtFull(b.value, currency)}</p>
      <p className="text-gray-500">{b.pct.toFixed(1)}% of portfolio</p>
    </div>
  )
}

const BETA_LABELS: Record<string, string> = {
  Defensive:  'β < 0.5 — less volatile than market',
  Moderate:   'β 0.5–1.0 — moves with market',
  Growth:     'β 1.0–1.5 — more volatile than market',
  Aggressive: 'β > 1.5 — highly volatile',
  Unknown:    'Beta unavailable',
}

export function RiskCompositionChart({ data, currency }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
        No risk data available.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151' }} width={80} />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {data.map((b) => (
              <Cell key={b.name} fill={RISK_COLORS[b.name] ?? '#9ca3af'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="space-y-1">
        {data.map((b) => (
          <div key={b.name} className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: RISK_COLORS[b.name] ?? '#9ca3af' }} />
            <span className="font-medium text-gray-700">{b.name}</span>
            <span>— {BETA_LABELS[b.name]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
