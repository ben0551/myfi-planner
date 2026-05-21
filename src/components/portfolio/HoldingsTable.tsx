'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { formatCurrency, formatNumber, formatPercent, gainClass } from '@/lib/formatters'
import type { Holding } from '@/lib/types'

interface Lot {
  date: string
  qty: number
  costPerUnit: number
  totalCost: number
  currentPrice: number | null
  totalGain: number | null
  gainPct: number | null
  holdDays: number
  discountEligible: boolean
}

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
  | 'dividendsReceived'
  | 'weight'

interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function Sparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return <span className="block w-14 h-5" />
  const W = 56, H = 20
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const pts = prices
    .map((p, i) => `${(i / (prices.length - 1)) * W},${H - ((p - min) / range) * (H - 2) + 1}`)
    .join(' ')
  const up = prices[prices.length - 1] >= prices[0]
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? '#059669' : '#dc2626'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LotsPanel({ lots, currency }: { lots: Lot[]; currency: string }) {
  return (
    <div className="bg-gray-50 dark:bg-slate-900/50 px-6 py-3 border-t border-gray-100 dark:border-slate-700">
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">
        Cost basis parcels · FIFO · remaining after all sells
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 dark:text-slate-500 uppercase tracking-wide">
              <th className="pb-1.5 pr-4 font-medium">Purchased</th>
              <th className="pb-1.5 pr-4 font-medium text-right">Qty</th>
              <th className="pb-1.5 pr-4 font-medium text-right">Cost/Unit</th>
              <th className="pb-1.5 pr-4 font-medium text-right">Total Cost</th>
              <th className="pb-1.5 pr-4 font-medium text-right">Gain / Loss</th>
              <th className="pb-1.5 pr-4 font-medium text-right">Gain %</th>
              <th className="pb-1.5 pr-4 font-medium text-right">Held</th>
              <th className="pb-1.5 font-medium">CGT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
            {lots.map((lot, i) => (
              <tr key={i} className="text-gray-700 dark:text-slate-300">
                <td className="py-1.5 pr-4 tabular-nums">{lot.date}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {lot.qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {formatCurrency(lot.costPerUnit, currency)}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {formatCurrency(lot.totalCost, currency)}
                </td>
                <td className={`py-1.5 pr-4 text-right tabular-nums font-medium ${gainClass(lot.totalGain)}`}>
                  {lot.totalGain !== null ? formatCurrency(lot.totalGain, currency) : '—'}
                </td>
                <td className={`py-1.5 pr-4 text-right tabular-nums font-medium ${gainClass(lot.gainPct)}`}>
                  {lot.gainPct !== null
                    ? `${lot.gainPct >= 0 ? '+' : ''}${lot.gainPct.toFixed(1)}%`
                    : '—'}
                </td>
                <td className="py-1.5 pr-4 text-right text-gray-500">
                  {lot.holdDays >= 365
                    ? `${(lot.holdDays / 365).toFixed(1)}y`
                    : `${lot.holdDays}d`}
                </td>
                <td className="py-1.5">
                  {lot.discountEligible ? (
                    <span className="rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1.5 py-0.5 font-medium">
                      50% disc.
                    </span>
                  ) : (
                    <span className="text-gray-400">Full CGT</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function HoldingsTable({ holdings, currency, portfolioId, drpTickers = {} }: HoldingsTableProps) {
  const [sort, setSort]         = useState<SortState>({ key: 'currentValue', dir: 'desc' })
  const [drpState, setDrpState] = useState<Record<string, boolean>>(drpTickers)
  const [saving, setSaving]     = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: sparklines = {} } = useSWR<Record<string, number[]>>(
    `/api/portfolios/${portfolioId}/sparklines`,
    fetcher
  )
  const { data: lots = {} } = useSWR<Record<string, Lot[]>>(
    `/api/portfolios/${portfolioId}/lots`,
    fetcher
  )

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
    if (sort.key === 'ticker')       { av = a.ticker; bv = b.ticker }
    else if (sort.key === 'weight')  { av = a.weight; bv = b.weight }
    else { av = a[sort.key as keyof Holding] as number | null; bv = b[sort.key as keyof Holding] as number | null }
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    if (typeof av === 'string' && typeof bv === 'string')
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    )
  }

  function Th({ col, label, right }: { col: SortKey; label: string; right?: boolean }) {
    const active = sort.key === col
    return (
      <th
        className={`pb-3 pr-4 font-medium cursor-pointer select-none hover:text-gray-700 transition-colors ${right ? 'text-right' : ''}`}
        onClick={() => toggleSort(col)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className="w-3 text-gray-400">{active ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
        </span>
      </th>
    )
  }

  const COLS = 13

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            <th className="pb-3 w-6" />
            <Th col="ticker"            label="Ticker" />
            <th className="pb-3 pr-4 font-medium">30D</th>
            <Th col="quantity"          label="Qty"       right />
            <Th col="avgCost"           label="Avg Cost"  right />
            <Th col="currentPrice"      label="Price"     right />
            <Th col="currentValue"      label="Value"     right />
            <Th col="unrealisedGain"    label="Cap. Gain" right />
            <Th col="dividendsReceived" label="Income"    right />
            <Th col="unrealisedGainPct" label="Return %"  right />
            <Th col="weight"            label="Weight"    right />
            <th className="pb-3 pr-4 font-medium text-right">Currency</th>
            <th className="pb-3 pr-4 font-medium text-right">DRP</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => (
            <>
              <tr
                key={h.ticker}
                className="border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-3 pl-1 w-6">
                  <button
                    onClick={() => setExpanded((prev) => (prev === h.ticker ? null : h.ticker))}
                    className="text-gray-400 hover:text-indigo-600 transition-colors text-xs leading-none"
                    title="Show cost basis parcels"
                  >
                    {expanded === h.ticker ? '▾' : '▸'}
                  </button>
                </td>

                <td className="py-3 pr-4">
                  <Link href={`/research/${h.ticker}`} className="font-semibold text-indigo-600 hover:text-indigo-800">
                    {h.ticker}
                  </Link>
                </td>

                <td className="py-3 pr-4">
                  <Sparkline prices={sparklines[h.ticker] ?? []} />
                </td>

                <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                  {formatNumber(h.quantity, 0)}
                </td>
                <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                  {formatCurrency(h.avgCost, currency)}
                </td>
                <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                  {h.currentPrice !== null ? (
                    formatCurrency(h.currentPrice, currency)
                  ) : (
                    <span className="text-gray-400 dark:text-slate-500 text-xs">unavailable</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-right font-medium text-gray-900 dark:text-white">
                  {h.currentValue !== null ? formatCurrency(h.currentValue, currency) : '—'}
                </td>
                <td className={`py-3 pr-4 text-right font-medium ${gainClass(h.unrealisedGain)}`}>
                  {h.unrealisedGain !== null ? formatCurrency(h.unrealisedGain, currency) : '—'}
                </td>
                <td className="py-3 pr-4 text-right font-medium text-emerald-700">
                  {h.dividendsReceived > 0 ? formatCurrency(h.dividendsReceived, currency) : '—'}
                </td>
                <td className={`py-3 pr-4 text-right font-medium ${gainClass(h.unrealisedGainPct)}`}>
                  {h.unrealisedGainPct !== null ? formatPercent(h.unrealisedGainPct) : '—'}
                </td>
                <td className="py-3 text-right text-gray-500 dark:text-slate-400">
                  {h.weight !== null ? `${h.weight.toFixed(1)}%` : '—'}
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="text-xs text-gray-400 font-mono">{currency}</span>
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

              {expanded === h.ticker && (
                <tr key={`${h.ticker}-lots`}>
                  <td colSpan={COLS} className="p-0">
                    {lots[h.ticker] ? (
                      <LotsPanel lots={lots[h.ticker]} currency={currency} />
                    ) : (
                      <div className="bg-gray-50 dark:bg-slate-900/50 px-6 py-3 text-xs text-gray-400">
                        Loading parcels…
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
