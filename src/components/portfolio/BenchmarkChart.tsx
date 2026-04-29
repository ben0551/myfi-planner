'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

interface DataPoint {
  date: string
  portfolio: number
  benchmark: number
}

interface Props {
  data: DataPoint[]
  benchmarkLabel: string
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
}

function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

interface TooltipProps {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{fmtDate(label)}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className={`font-medium ${p.value >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {fmtPct(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function BenchmarkChart({ data, benchmarkLabel }: Props) {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        Not enough snapshot history to compare — check back after a few days.
      </div>
    )
  }

  const latest = data[data.length - 1]
  const diff = latest.portfolio - latest.benchmark
  const portfolioAhead = diff >= 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-gray-500">Portfolio: </span>
          <span className={`font-bold ${latest.portfolio >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {fmtPct(latest.portfolio)}
          </span>
        </div>
        <div>
          <span className="text-gray-500">{benchmarkLabel}: </span>
          <span className={`font-bold ${latest.benchmark >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {fmtPct(latest.benchmark)}
          </span>
        </div>
        <div className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${portfolioAhead ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {portfolioAhead ? '+' : ''}{diff.toFixed(1)}% vs index
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradPortfolio" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradBenchmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
          <YAxis tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} width={56} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#e5e7eb" />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="benchmark" name={benchmarkLabel} stroke="#9ca3af" strokeWidth={1.5} fill="url(#gradBenchmark)" dot={false} />
          <Area type="monotone" dataKey="portfolio" name="Portfolio" stroke="#4f46e5" strokeWidth={2} fill="url(#gradPortfolio)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
