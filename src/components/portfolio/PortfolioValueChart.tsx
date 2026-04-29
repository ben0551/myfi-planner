'use client'

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
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

interface Props {
  portfolioId: string
  currency: string
}

export function PortfolioValueChart({ portfolioId, currency }: Props) {
  const { data, error } = useSWR<Snapshot[]>(
    `/api/portfolios/${portfolioId}/snapshots`,
    fetcher
  )

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

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0891b2" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => formatCurrency(v, currency, true)}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          width={80}
        />
        <Tooltip
          labelFormatter={(label) => formatDate(label as string)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            formatCurrency(value, currency),
            name === 'value' ? 'Market Value' : 'Invested',
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 12, color: '#374151' }}>
              {value === 'value' ? 'Market Value' : 'Invested'}
            </span>
          )}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#4f46e5"
          strokeWidth={2}
          fill="url(#colorValue)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="invested"
          stroke="#0891b2"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill="url(#colorInvested)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
