'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency, formatNumber, formatPercent, gainClass } from '@/lib/formatters'
import type { Holding } from '@/lib/types'

interface HoldingsTableProps {
  holdings: Holding[]
  currency: string
  portfolioId: string
  drpTickers?: Record<string, boolean>
}

type SortKey =
  | 'ticker'
  | 'quantity'
  | 'avgCost'
  | 'currentPrice'
  | 'currentValue'
  | 'unrealisedGain'
  | 'unrealisedGainPct'
  | 'weight'

interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

export function HoldingsTable({ holdings, currency, portfolioId, drpTickers = {} }: HoldingsTableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'currentValue', dir: 'desc' })
  const [drpState, setDrpState] = useState<Record<string, boolean>>(drpTickers)
  const [saving, setSaving] = useState<string | null>(null)

  async function toggleDrp(ticker: string) {
    const next = !drpState[ticker]
    setDrpState((s) => ({ ...s, [ticker]: next }))
    setSaving(ticker)
    await fetch(`/api/portfolios/${portfolioId}/ticker-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, drpEnabled: next }),
    })
    setSaving(null)
  }

  if (holdings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium">No holdings yet</p>
        <p className="text-sm mt-1">Add a BUY transaction to get started.</p>
      </div>
    )
  }

  const totalValue = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0)

  const withWeight = holdings.map((h) => ({
    ...h,
    weight: totalValue > 0 && h.currentValue ? (h.currentValue / totalValue) * 100 : null,
  }))

  const sorted = [...withWeight].sort((a, b) => {
    let av: number | string | null
    let bv: number | string | null

    if (sort.key === 'ticker') {
      av = a.ticker
      bv = b.ticker
    } else if (sort.key === 'weight') {
      av = a.weight
      bv = b.weight
    } else {
      av = a[sort.key as keyof Holding] as number | null
      bv = b[sort.key as keyof Holding] as number | null
    }

    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    if (typeof av === 'string' && typeof bv === 'string') {
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sort.dir === 'asc'
      ? (av as number) - (bv as number)
      : (bv as number) - (av as number)
  })

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' }
    )
  }

  function Th({ col, label, right }: { col: SortKey; label: string; right?: boolean }) {
    const active = sort.key === col
    return (
      <th
        className={`pb-3 pr-4 font-medium cursor-pointer select-none hover:text-gray-700 transition-colors ${right ? 'text-right' : ''}`}
        onClick={() => toggleSort(col)}
      >
        <span className="inline-flex items-center gap-1 justify-end">
          {label}
          <span className="w-3 text-gray-400">{active ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
        </span>
      </th>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <Th col="ticker" label="Ticker" />
            <Th col="quantity" label="Qty" right />
            <Th col="avgCost" label="Avg Cost" right />
            <Th col="currentPrice" label="Current Price" right />
            <Th col="currentValue" label="Market Value" right />
            <Th col="unrealisedGain" label="Unrealised Gain" right />
            <Th col="unrealisedGainPct" label="Return %" right />
            <Th col="weight" label="Weight" right />
            <th className="pb-3 pr-4 font-medium text-right">DRP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((h) => (
            <tr key={h.ticker} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 pr-4">
                <Link
                  href={`/research/${h.ticker}`}
                  className="font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {h.ticker}
                </Link>
              </td>
              <td className="py-3 pr-4 text-right text-gray-700">
                {formatNumber(h.quantity, 0)}
              </td>
              <td className="py-3 pr-4 text-right text-gray-700">
                {formatCurrency(h.avgCost, currency)}
              </td>
              <td className="py-3 pr-4 text-right text-gray-700">
                {h.currentPrice !== null ? (
                  formatCurrency(h.currentPrice, currency)
                ) : (
                  <span className="text-gray-400 text-xs">unavailable</span>
                )}
              </td>
              <td className="py-3 pr-4 text-right font-medium text-gray-900">
                {h.currentValue !== null ? formatCurrency(h.currentValue, currency) : '—'}
              </td>
              <td className={`py-3 pr-4 text-right font-medium ${gainClass(h.unrealisedGain)}`}>
                {h.unrealisedGain !== null
                  ? formatCurrency(h.unrealisedGain, currency)
                  : '—'}
              </td>
              <td className={`py-3 pr-4 text-right font-medium ${gainClass(h.unrealisedGainPct)}`}>
                {h.unrealisedGainPct !== null ? formatPercent(h.unrealisedGainPct) : '—'}
              </td>
              <td className="py-3 text-right text-gray-500">
                {h.weight !== null ? `${h.weight.toFixed(1)}%` : '—'}
              </td>
              <td className="py-3 pr-4 text-right">
                <button
                  onClick={() => toggleDrp(h.ticker)}
                  disabled={saving === h.ticker}
                  title={drpState[h.ticker] ? 'DRP enabled — click to disable' : 'DRP disabled — click to enable'}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                    drpState[h.ticker]
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  } ${saving === h.ticker ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {drpState[h.ticker] ? 'DRP' : 'Cash'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
