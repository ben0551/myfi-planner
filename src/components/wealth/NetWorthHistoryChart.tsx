'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import useSWR from 'swr'

interface Snapshot {
  date: string
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  sharesValue: number
  propertyValue: number
  superBalance: number
  cashBalance: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function fmt(v: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', notation: 'compact', maximumFractionDigits: 1 }).format(v)
}

function fmtFull(v: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(v)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{fmtDate(label)}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-gray-800">{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function NetWorthHistoryChart() {
  const { data, error } = useSWR<Snapshot[]>('/api/wealth/net-worth-history', fetcher)

  if (error) return null
  if (!data) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
  if (data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
        No data yet — add portfolios, super, or property to start tracking history.
      </div>
    )
  }
  if (data.length < 2) {
    const today = data[0]
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4">
        {[
          { label: 'Net Worth', value: today.netWorth, color: 'text-emerald-700' },
          { label: 'Total Assets', value: today.totalAssets, color: 'text-indigo-700' },
          { label: 'Total Debt', value: today.totalLiabilities, color: 'text-red-600' },
          { label: 'Shares', value: today.sharesValue, color: 'text-gray-900' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{fmtFull(value)}</p>
          </div>
        ))}
        <p className="col-span-full text-xs text-gray-400 mt-1">
          History chart will appear once there are multiple dated data points.
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradAssets" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradNW" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradDebt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#dc2626" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} width={72} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#e5e7eb" />
        <Area type="monotone" dataKey="totalAssets" name="Total Assets" stroke="#4f46e5" strokeWidth={1.5} fill="url(#gradAssets)" dot={false} />
        <Area type="monotone" dataKey="netWorth" name="Net Worth" stroke="#059669" strokeWidth={2} fill="url(#gradNW)" dot={false} />
        <Area type="monotone" dataKey="totalLiabilities" name="Total Debt" stroke="#dc2626" strokeWidth={1.5} fill="url(#gradDebt)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
