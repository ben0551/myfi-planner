'use client'

import useSWR from 'swr'
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import type { IncomeResponse } from '@/app/api/income/route'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function IncomeDashboard() {
  const { data, error } = useSWR<IncomeResponse>('/api/income', fetcher)

  if (error) return <div className="text-sm text-red-500">Failed to load income data.</div>
  if (!data) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400 text-sm animate-pulse">
        Loading...
      </div>
    )
  }

  const { months, trailing12Total, projected12Total, byTicker, currency } = data
  const now = new Date()
  const thisMonthLabel = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()]} ${String(now.getFullYear()).slice(2)}`

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">Trailing 12 Months</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {formatCurrency(trailing12Total, currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Actual dividends received</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">Projected 12 Months</p>
          <p className="text-2xl font-bold mt-1 text-indigo-600">
            {formatCurrency(projected12Total, currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Based on historical patterns</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">Monthly Average</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {formatCurrency(trailing12Total / 12, currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Trailing 12-month average</p>
        </Card>
      </div>

      {/* Bar chart */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Monthly Income</h2>
        <p className="text-xs text-gray-400 mb-4">Solid = received · Striped = projected</p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={months} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <pattern id="projectedPattern" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M 0,6 l 6,-6 M -1.5,1.5 l 3,-3 M 4.5,7.5 l 3,-3" stroke="#818cf8" strokeWidth={1.5} />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis
              tickFormatter={(v) => formatCurrency(v, currency, true)}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              width={72}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                formatCurrency(Number(value), currency),
                name === 'actual' ? 'Received' : 'Projected',
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Legend
              formatter={(value) => (
                <span style={{ fontSize: 12, color: '#374151' }}>
                  {value === 'actual' ? 'Received' : 'Projected'}
                </span>
              )}
            />
            <ReferenceLine x={thisMonthLabel} stroke="#d1d5db" strokeDasharray="4 2" label={{ value: 'Today', fontSize: 10, fill: '#9ca3af' }} />
            <Bar dataKey="actual" fill="#4f46e5" radius={[3, 3, 0, 0]} maxBarSize={32} />
            <Bar dataKey="projected" fill="url(#projectedPattern)" stroke="#818cf8" strokeWidth={1} radius={[3, 3, 0, 0]} maxBarSize={32} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Per-ticker breakdown */}
      {byTicker.length > 0 && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Income by Holding</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Annual estimate based on last 12 months of payments
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {byTicker.map((t) => (
              <div key={t.ticker} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white w-16">{t.ticker}</span>
                  <span className="text-xs text-gray-400">
                    {t.paymentsPerYear}× / yr · last {formatCurrency(t.lastPayment, currency)}
                  </span>
                </div>
                <span className="font-medium text-sm text-indigo-600">
                  {formatCurrency(t.annualEstimate, currency)} / yr
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {byTicker.length === 0 && (
        <Card>
          <div className="py-8 text-center text-gray-400 text-sm">
            No dividend history in the last 12 months for your current holdings.
          </div>
        </Card>
      )}
    </div>
  )
}
