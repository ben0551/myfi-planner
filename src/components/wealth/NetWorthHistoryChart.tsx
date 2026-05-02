'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart, AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import useSWR from 'swr'

interface Snapshot {
  date: string
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  sharesValue: number
  tdValue: number
  propertyValue: number
  superBalance: number
  cashBalance: number
}

type Range = '3m' | '6m' | '1y' | 'all'
type View  = 'overview' | 'breakdown'

const RANGES: { key: Range; label: string; days: number }[] = [
  { key: '3m',  label: '3M',  days: 90  },
  { key: '6m',  label: '6M',  days: 180 },
  { key: '1y',  label: '1Y',  days: 365 },
  { key: 'all', label: 'All', days: Infinity },
]

const ASSET_SERIES = [
  { key: 'cashBalance',   name: 'Cash',          color: '#10b981' },
  { key: 'tdValue',       name: 'Term Deposits', color: '#0ea5e9' },
  { key: 'superBalance',  name: 'Super',         color: '#3b82f6' },
  { key: 'propertyValue', name: 'Property',      color: '#f59e0b' },
  { key: 'sharesValue',   name: 'Shares',        color: '#6366f1' },
] as const

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
function fmtDateLong(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

type TEntry = { name?: string | number; value?: number; color?: string }

function CustomTooltip({ active, payload, label, view }: {
  active?: boolean; payload?: readonly TEntry[]; label?: string; view: View
}) {
  if (!active || !payload?.length || !label) return null

  const named = payload.map((p) => ({ name: String(p.name ?? ''), value: p.value ?? 0, color: p.color ?? '#888' }))

  // In breakdown mode keep the order: stacked series (bottom→top) + debt + net worth
  // Recharts reverses stacked order in payload, so flip it back for display
  const entries = view === 'breakdown' ? [...named].reverse() : named

  const nwEntry   = entries.find((p) => p.name === 'Net Worth')
  const debtEntry = entries.find((p) => p.name === 'Debt')
  const assetRows = entries.filter((p) => p.name !== 'Net Worth' && p.name !== 'Debt' && p.name !== 'Total Assets')

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[175px]">
      <p className="font-semibold text-gray-700 mb-2">{fmtDateLong(label)}</p>

      {view === 'breakdown' ? (
        <>
          {assetRows.map((p) => (
            <div key={p.name} className="flex justify-between gap-4 mb-0.5">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: p.color }} />
                {p.name}
              </span>
              <span className="font-medium text-gray-700">{fmtFull(p.value)}</span>
            </div>
          ))}
          {debtEntry && (
            <div className="flex justify-between gap-4 mt-1.5 pt-1.5 border-t border-gray-100">
              <span className="text-red-500">Debt</span>
              <span className="font-medium text-red-600">−{fmtFull(debtEntry.value)}</span>
            </div>
          )}
          {nwEntry && (
            <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-gray-200 font-semibold">
              <span style={{ color: nwEntry.color }}>Net Worth</span>
              <span className="text-gray-900">{fmtFull(nwEntry.value)}</span>
            </div>
          )}
        </>
      ) : (
        <>
          {entries.map((p) => (
            <div key={p.name} className="flex justify-between gap-4 mb-0.5">
              <span style={{ color: p.color }}>{p.name}</span>
              <span className="font-medium text-gray-800">{fmtFull(p.value)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export function NetWorthHistoryChart() {
  const { data, error } = useSWR<Snapshot[]>('/api/wealth/net-worth-history', fetcher)
  const [range, setRange] = useState<Range>('all')
  const [view,  setView]  = useState<View>('overview')

  const filteredData = useMemo(() => {
    if (!data || range === 'all') return data ?? []
    const days = RANGES.find((r) => r.key === range)?.days ?? Infinity
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const within = data.filter((d) => d.date >= cutoffStr)
    const before = [...data].reverse().find((d) => d.date < cutoffStr)
    if (before) return [{ ...before, date: cutoffStr }, ...within]
    return within
  }, [data, range])

  const periodDelta = useMemo(() => {
    if (filteredData.length < 2 || range === 'all') return null
    const start = filteredData[0].netWorth
    const end   = filteredData[filteredData.length - 1].netWorth
    const delta = end - start
    const pct   = start !== 0 ? (delta / Math.abs(start)) * 100 : null
    return { delta, pct }
  }, [filteredData, range])

  const current = useMemo(() => filteredData[filteredData.length - 1] ?? null, [filteredData])

  const activeSeries = useMemo(() =>
    ASSET_SERIES.filter((s) =>
      filteredData.some((d) => (d[s.key as keyof Snapshot] as number) > 0)
    ),
  [filteredData])

  if (error) return null
  if (!data) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
  if (data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
        No data yet — add portfolios, super, or property to start tracking history.
      </div>
    )
  }
  if (filteredData.length < 2) {
    const today = filteredData[0] ?? data[data.length - 1]
    return (
      <div className="space-y-4">
        <Controls range={range} setRange={setRange} view={view} setView={setView} data={data} />
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
            {data.length < 2
              ? 'History chart will appear once there are multiple dated data points.'
              : 'No data in the selected range — try a wider range.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header row: period delta left, controls right */}
      <div className="flex items-center justify-between gap-2">
        {periodDelta ? (
          <span className={`text-sm font-medium ${periodDelta.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {periodDelta.delta >= 0 ? '+' : ''}{fmtFull(periodDelta.delta)}
            {periodDelta.pct != null && (
              <span className="ml-1.5 text-xs font-normal opacity-75">
                ({periodDelta.pct >= 0 ? '+' : ''}{periodDelta.pct.toFixed(1)}%)
              </span>
            )}
          </span>
        ) : <span />}
        <Controls range={range} setRange={setRange} view={view} setView={setView} data={data} />
      </div>

      {/* Chart */}
      {view === 'overview' ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={filteredData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAssets" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradNW" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#059669" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradDebt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} width={72} />
            <Tooltip content={(p: unknown) => <CustomTooltip {...(p as TEntry)} view="overview" />} />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Area type="monotone" dataKey="totalAssets"     name="Total Assets" stroke="#4f46e5" strokeWidth={1.5} fill="url(#gradAssets)" dot={false} />
            <Area type="monotone" dataKey="netWorth"        name="Net Worth"    stroke="#059669" strokeWidth={2}   fill="url(#gradNW)"    dot={false} />
            <Area type="monotone" dataKey="totalLiabilities" name="Debt"         stroke="#dc2626" strokeWidth={1.5} fill="url(#gradDebt)"  dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={filteredData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              {activeSeries.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={s.color} stopOpacity={0.7} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.4} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} width={72} />
            <Tooltip content={(p: unknown) => <CustomTooltip {...(p as TEntry)} view="breakdown" />} />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            {activeSeries.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stackId="assets"
                stroke={s.color}
                strokeWidth={0}
                fill={`url(#grad-${s.key})`}
                dot={false}
              />
            ))}
            <Line type="monotone" dataKey="totalLiabilities" name="Debt"      stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="netWorth"         name="Net Worth" stroke="#059669" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Breakdown legend with current values */}
      {view === 'breakdown' && current && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1">
          {activeSeries.slice().reverse().map((s) => {
            const val = current[s.key as keyof Snapshot] as number
            if (!val) return null
            return (
              <div key={s.key} className="flex items-center gap-1.5 text-xs">
                <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                <span className="text-gray-500">{s.name}</span>
                <span className="font-medium text-gray-800">{fmtFull(val)}</span>
              </div>
            )
          })}
          {current.totalLiabilities > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0 bg-red-400" />
              <span className="text-gray-500">Debt</span>
              <span className="font-medium text-red-600">−{fmtFull(current.totalLiabilities)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs ml-auto">
            <span className="text-gray-400">Net Worth</span>
            <span className="font-semibold text-emerald-700">{fmtFull(current.netWorth)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Controls({ range, setRange, view, setView, data }: {
  range: Range; setRange: (r: Range) => void
  view:  View;  setView:  (v: View)  => void
  data: Snapshot[]
}) {
  const earliest = data[0]?.date ?? ''
  const availableRanges = RANGES.filter(({ days }) => {
    if (days === Infinity) return true
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return earliest <= cutoff.toISOString().slice(0, 10) === false || data.length > 0
  })

  return (
    <div className="flex items-center gap-2">
      {/* View toggle */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
        {(['overview', 'breakdown'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-2.5 py-1 capitalize transition-colors ${
              view === v ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-gray-200" />

      {/* Range buttons */}
      <div className="flex gap-1">
        {availableRanges.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              range === key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
