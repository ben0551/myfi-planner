'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import useSWR from 'swr'

interface PricePoint {
  date: string
  close: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const RANGES = [
  { label: '1W', count: 7 },
  { label: '1M', count: 30 },
  { label: '3M', count: 90 },
  { label: '1Y', count: 252 },
  { label: '2Y', count: 500 },
] as const

type Range = (typeof RANGES)[number]

export function PriceChart({ ticker }: { ticker: string }) {
  const [range, setRange] = useState<Range>(RANGES[3])

  const { data, isLoading } = useSWR<PricePoint[]>(
    `/api/asx/history/${ticker}?count=${range.count}`,
    fetcher
  )

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              range.label === r.label
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />
      ) : !data || data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
          No price history available
        </div>
      ) : (
        <Chart data={data} />
      )}
    </div>
  )
}

function Chart({ data }: { data: PricePoint[] }) {
  const formatted = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric',
    }),
    price: d.close,
  }))

  const prices = formatted.map((d) => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const padding = (max - min) * 0.1 || max * 0.05

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          interval="preserveStartEnd"
          tickLine={false}
        />
        <YAxis
          domain={[min - padding, max + padding]}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickFormatter={(v) => `$${v.toFixed(2)}`}
          width={60}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => [`$${Number(v).toFixed(3)}`, 'Price']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#4f46e5"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
