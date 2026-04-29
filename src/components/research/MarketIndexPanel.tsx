'use client'

import useSWR from 'swr'
import { MarketIndexLink } from './MarketIndexLink'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Snapshot {
  ticker: string
  companyName: string | null
  price: number | null
  change: number | null
  changePct: number | null
  volume: string | null
  marketCap: string | null
  peRatio: number | null
  eps: number | null
  dividendYield: number | null
  dividendAmount: number | null
  frankingPct: number | null
  high52Week: number | null
  low52Week: number | null
  sector: string | null
  industry: string | null
  fetchedAt: string
}

function fmt(v: number | null, prefix = '', suffix = '', decimals = 2): string {
  if (v == null) return '—'
  return `${prefix}${v.toFixed(decimals)}${suffix}`
}

function fmtAge(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function MarketIndexPanel({ ticker }: { ticker: string }) {
  const { data, isLoading, mutate } = useSWR<Snapshot | null>(
    `/api/research/marketindex/${ticker}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 rounded" />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-4 text-sm text-gray-400">
        Data will appear here after your first visit to this ticker&apos;s research page.
      </div>
    )
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Price', value: fmt(data.price, '$') },
    { label: 'Change', value: data.change != null ? `${data.change >= 0 ? '+' : ''}${fmt(data.change, '$')} (${fmt(data.changePct, '', '%')})` : '—' },
    { label: 'Volume', value: data.volume ?? '—' },
    { label: 'Market Cap', value: data.marketCap ? `$${data.marketCap}` : '—' },
    { label: 'P/E Ratio', value: fmt(data.peRatio, '', '', 1) },
    { label: 'EPS', value: fmt(data.eps, '$') },
    { label: 'Dividend Yield', value: fmt(data.dividendYield, '', '%', 2) },
    { label: 'Annual Dividend', value: fmt(data.dividendAmount, '$') },
    { label: 'Franking', value: data.frankingPct != null ? `${data.frankingPct}%` : '—' },
    { label: '52-Week Range', value: data.low52Week != null && data.high52Week != null ? `$${data.low52Week.toFixed(2)} – $${data.high52Week.toFixed(2)}` : '—' },
    { label: 'Sector', value: data.sector ?? '—' },
    { label: 'Industry', value: data.industry ?? '—' },
  ].filter((r) => r.value !== '—')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Refreshed {fmtAge(data.fetchedAt)} · Yahoo Finance</span>
        <MarketIndexLink
          ticker={ticker}
          className="text-indigo-500 hover:text-indigo-700 transition-colors"
        />
      </div>

      <div className="divide-y divide-gray-50">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between py-2 text-sm">
            <span className="text-gray-500">{label}</span>
            <span className={`font-medium ${
              label === 'Change' && data.change != null
                ? data.change >= 0 ? 'text-emerald-600' : 'text-red-600'
                : 'text-gray-900'
            }`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
