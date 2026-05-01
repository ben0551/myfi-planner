'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart,
  BarChart,
  Area,
  Bar,
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
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

interface ChartRow {
  label: string
  close: number
  open: number
  high: number
  low: number
  volume: number | null
  ma50: number | null
  ma200: number | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 65 },
  { label: '6M', days: 130 },
  { label: '1Y', days: 252 },
  { label: '2Y', days: 504 },
] as const

type RangeLabel = (typeof RANGES)[number]['label']

function sma(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null
    const slice = closes.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

function fmtVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(v)
}

export function PriceChart({ ticker }: { ticker: string }) {
  const [rangeLabel, setRangeLabel] = useState<RangeLabel>('1Y')
  const [showMA50, setShowMA50] = useState(true)
  const [showMA200, setShowMA200] = useState(true)

  // Always fetch max history so MAs are accurate regardless of displayed range
  const { data: raw, isLoading } = useSWR<PricePoint[]>(
    `/api/asx/history/${ticker}?count=504`,
    fetcher
  )

  const currentRange = RANGES.find((r) => r.label === rangeLabel)!

  const { displayed, priceMin, priceMax, isUp } = useMemo(() => {
    if (!raw || raw.length === 0) return { displayed: [], priceMin: 0, priceMax: 0, isUp: true }

    const closes = raw.map((p) => p.close)
    const ma50vals = sma(closes, 50)
    const ma200vals = sma(closes, 200)

    const all: ChartRow[] = raw.map((p, i) => ({
      label: new Date(p.date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
      close: p.close,
      open: p.open,
      high: p.high,
      low: p.low,
      volume: p.volume,
      ma50: ma50vals[i],
      ma200: ma200vals[i],
    }))

    const sliced = all.slice(-currentRange.days)
    const prices = sliced.map((d) => d.close)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const pad = (max - min) * 0.08 || max * 0.05

    return {
      displayed: sliced,
      priceMin: min - pad,
      priceMax: max + pad,
      isUp: sliced.length > 1 && sliced[sliced.length - 1].close >= sliced[0].close,
    }
  }, [raw, currentRange])

  const lineColor = isUp ? '#10b981' : '#ef4444'
  const gradientId = `grad-${ticker}`

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRangeLabel(r.label)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                rangeLabel === r.label
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMA50((v) => !v)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              showMA50
                ? 'border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-400'
                : 'border-gray-200 text-gray-400 dark:border-slate-600'
            }`}
          >
            MA50
          </button>
          <button
            onClick={() => setShowMA200((v) => !v)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              showMA200
                ? 'border-orange-300 text-orange-600 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700 dark:text-orange-400'
                : 'border-gray-200 text-gray-400 dark:border-slate-600'
            }`}
          >
            MA200
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-64 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-lg" />
          <div className="h-14 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-lg" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
          No price history available
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={displayed} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[priceMin, priceMax]}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                width={62}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<PriceTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: lineColor }}
              />
              {showMA50 && (
                <Line
                  type="monotone"
                  dataKey="ma50"
                  stroke="#60a5fa"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  activeDot={false}
                />
              )}
              {showMA200 && (
                <Line
                  type="monotone"
                  dataKey="ma200"
                  stroke="#fb923c"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  activeDot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          <div className="mt-1">
            <ResponsiveContainer width="100%" height={55}>
              <BarChart data={displayed} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" hide />
                <YAxis hide />
                <Bar dataKey="volume" fill="#d1d5db" maxBarSize={6} radius={[1, 1, 0, 0]} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.[0]?.value != null ? (
                      <div className="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600">
                        Vol {fmtVol(Number(payload[0].value))}
                      </div>
                    ) : null
                  }
                />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-right text-xs text-gray-400 pr-1 -mt-0.5">Volume</p>
          </div>
        </>
      )}
    </div>
  )
}

function PriceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { dataKey: string; value: number; payload: ChartRow }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const ma50entry = payload.find((p) => p.dataKey === 'ma50')
  const ma200entry = payload.find((p) => p.dataKey === 'ma200')
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2.5 text-xs">
      <p className="font-medium text-gray-700 mb-1.5">{label}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="text-gray-400">O</span>
        <span className="font-mono">${d.open.toFixed(3)}</span>
        <span className="text-gray-400">H</span>
        <span className="font-mono">${d.high.toFixed(3)}</span>
        <span className="text-gray-400">L</span>
        <span className="font-mono">${d.low.toFixed(3)}</span>
        <span className="text-gray-400">C</span>
        <span className="font-mono font-semibold">${d.close.toFixed(3)}</span>
        {d.volume != null && (
          <>
            <span className="text-gray-400">Vol</span>
            <span className="font-mono">{fmtVol(d.volume)}</span>
          </>
        )}
      </div>
      {ma50entry?.value != null && (
        <p className="text-blue-500 mt-1.5">MA50 ${ma50entry.value.toFixed(3)}</p>
      )}
      {ma200entry?.value != null && (
        <p className="text-orange-500">MA200 ${ma200entry.value.toFixed(3)}</p>
      )}
    </div>
  )
}
