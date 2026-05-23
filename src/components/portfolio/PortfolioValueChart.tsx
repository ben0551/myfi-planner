'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import useSWR from 'swr'
import { formatCurrency } from '@/lib/formatters'

interface Snapshot {
  date: string
  value: number
  invested: number
  income?: number
}

type Range = '1M' | '3M' | '6M' | '1Y' | 'All'

const RANGES: { label: Range; days: number | null }[] = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: null },
]

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

interface Props {
  portfolioId: string
  currency: string
}

export function PortfolioValueChart({ portfolioId, currency }: Props) {
  const [range, setRange] = useState<Range>('All')

  const { data, error } = useSWR<Snapshot[]>(
    `/api/portfolios/${portfolioId}/snapshots`,
    fetcher
  )

  const filtered = useMemo(() => {
    if (!data) return []
    const sel = RANGES.find((r) => r.label === range)!
    if (sel.days === null) return data
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - sel.days)
    return data.filter((s) => new Date(s.date) >= cutoff)
  }, [data, range])

  if (error) return null
  if (!data) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        Not enough data yet — check back tomorrow
      </div>
    )
  }

  const seriesLabels: Record<string, string> = {
    value:    'Market Value',
    invested: 'Invested',
    income:   'Income',
  }

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => setRange(r.label)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              range === r.label
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={filtered} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0891b2" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#0891b2" stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#059669" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, currency, true)}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            width={80}
          />
          <Tooltip
            labelFormatter={(label) => fmtDate(label as string)}
            formatter={(value: unknown, name: unknown) => [
              formatCurrency(value as number, currency),
              seriesLabels[name as string] ?? String(name),
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: 12, color: '#374151' }}>
                {seriesLabels[value] ?? value}
              </span>
            )}
          />
          <Area type="monotone" dataKey="value"    stroke="#4f46e5" strokeWidth={2}   fill="url(#colorValue)"    dot={false} />
          <Area type="monotone" dataKey="invested" stroke="#0891b2" strokeWidth={1.5} fill="url(#colorInvested)" dot={false} strokeDasharray="4 4" />
          <Area type="monotone" dataKey="income"   stroke="#059669" strokeWidth={1.5} fill="url(#colorIncome)"   dot={false} strokeDasharray="2 2" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
