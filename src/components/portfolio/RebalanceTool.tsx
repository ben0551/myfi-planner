'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import type { RebalanceResponse, RebalanceTarget } from '@/app/api/portfolios/[id]/rebalance/route'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Props {
  portfolioId: string
  currency: string
}

export function RebalanceTool({ portfolioId, currency }: Props) {
  const { data, isLoading, mutate } = useSWR<RebalanceResponse>(
    `/api/portfolios/${portfolioId}/rebalance`,
    fetcher,
    { revalidateOnFocus: false }
  )

  // Target percentages — keyed by ticker, editable
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [newCash, setNewCash] = useState('')
  const [buyOnly, setBuyOnly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Initialise targets from server data once on first load
  const initialised = useMemo(() => {
    if (!data) return false
    return true
  }, [data])

  function getTargetPct(ticker: string): number {
    if (ticker in targets) return parseFloat(targets[ticker] || '0') || 0
    const saved = data?.holdings.find((h) => h.ticker === ticker)?.targetPct ?? 0
    return saved
  }

  function setTarget(ticker: string, value: string) {
    setTargets((prev) => ({ ...prev, [ticker]: value }))
    setDirty(true)
  }

  function distributeEvenly() {
    if (!data) return
    const count = data.holdings.length
    const pct = count > 0 ? (100 / count).toFixed(1) : '0'
    const next: Record<string, string> = {}
    for (const h of data.holdings) next[h.ticker] = pct
    setTargets(next)
    setDirty(true)
  }

  function clearTargets() {
    setTargets({})
    setDirty(true)
  }

  async function saveTargets() {
    if (!data) return
    setSaving(true)
    const payload: RebalanceTarget[] = data.holdings.map((h) => ({
      ticker: h.ticker,
      targetPct: getTargetPct(h.ticker),
    }))
    await fetch(`/api/portfolios/${portfolioId}/rebalance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets: payload }),
    })
    setSaving(false)
    setDirty(false)
    mutate()
  }

  // Compute suggested trades
  const trades = useMemo(() => {
    if (!data) return []
    const cash = parseFloat(newCash) || 0
    const total = data.totalValue + cash
    const totalTargetPct = data.holdings.reduce((s, h) => s + getTargetPct(h.ticker), 0)
    const hasTargets = totalTargetPct > 0

    return data.holdings.map((h) => {
      const tPct = hasTargets ? getTargetPct(h.ticker) : 0
      const targetValue = (tPct / 100) * total
      const delta = targetValue - h.currentValue
      return {
        ticker: h.ticker,
        currentValue: h.currentValue,
        currentPct: h.currentPct,
        targetPct: tPct,
        targetValue,
        delta,
        action: delta > 50 ? 'buy' : delta < -50 ? 'sell' : 'hold',
      }
    })
  }, [data, targets, newCash])

  const totalTargetPct = data
    ? data.holdings.reduce((s, h) => s + getTargetPct(h.ticker), 0)
    : 0
  const unallocated = Math.max(0, 100 - totalTargetPct)
  const overAllocated = totalTargetPct > 100.05

  if (isLoading) {
    return <div className="text-center py-12 text-sm text-gray-400 animate-pulse">Loading…</div>
  }

  if (!data || data.holdings.length === 0) {
    return (
      <Card>
        <p className="text-center text-gray-500 dark:text-slate-400 py-8 text-sm">
          No holdings to rebalance yet.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Options row */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              New cash to deploy
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={newCash}
                onChange={(e) => setNewCash(e.target.value)}
                placeholder="0"
                min="0"
                step="100"
                className="pl-7 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={buyOnly}
              onChange={(e) => setBuyOnly(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Buy-only mode (no sells)
          </label>

          <div className="flex gap-2 ml-auto">
            <button
              onClick={distributeEvenly}
              className="text-xs px-3 py-2 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Equal weight
            </button>
            <button
              onClick={clearTargets}
              className="text-xs px-3 py-2 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </Card>

      {/* Main table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-slate-700 text-xs uppercase tracking-wide text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Ticker</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right">Current Value</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right">Current %</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right">Target %</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right">Target Value</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right">Drift</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {trades.map((t) => {
                const skipSell = buyOnly && t.action === 'sell'
                return (
                  <tr key={t.ticker} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{t.ticker}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">
                      {formatCurrency(t.currentValue, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400">
                      {t.currentPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          value={
                            t.ticker in targets
                              ? targets[t.ticker]
                              : (data.holdings.find((h) => h.ticker === t.ticker)?.targetPct ?? 0) || ''
                          }
                          onChange={(e) => setTarget(t.ticker, e.target.value)}
                          placeholder="0"
                          min="0"
                          max="100"
                          step="0.5"
                          className="w-16 px-2 py-1 text-right text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-gray-400 text-xs">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400">
                      {t.targetPct > 0 ? formatCurrency(t.targetValue, currency) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.targetPct > 0 ? (
                        <span className={Math.abs(t.delta) > 50 ? (t.delta > 0 ? 'text-emerald-600' : 'text-red-500') : 'text-gray-400 dark:text-slate-500'}>
                          {t.delta > 0 ? '+' : ''}{formatCurrency(t.delta, currency)}
                        </span>
                      ) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {t.targetPct > 0 && !skipSell && Math.abs(t.delta) > 50 && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          t.action === 'buy'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                            : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                        }`}>
                          {t.action === 'buy' ? '↑ Buy' : '↓ Sell'} {formatCurrency(Math.abs(t.delta), currency)}
                        </span>
                      )}
                      {t.targetPct > 0 && skipSell && t.action === 'sell' && (
                        <span className="text-xs text-gray-400 dark:text-slate-500">skip (buy-only)</span>
                      )}
                      {(t.targetPct === 0 || (t.action === 'hold' && Math.abs(t.delta) <= 50)) && (
                        <span className="text-xs text-gray-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Allocation summary footer */}
            <tfoot className="border-t-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <td className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-white">
                  {formatCurrency(data.totalValue + (parseFloat(newCash) || 0), currency)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400 text-xs">100%</td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs font-semibold ${overAllocated ? 'text-red-600' : totalTargetPct > 0 ? 'text-gray-700 dark:text-slate-300' : 'text-gray-400'}`}>
                    {totalTargetPct.toFixed(1)}%
                  </span>
                  {unallocated > 0.1 && !overAllocated && (
                    <p className="text-xs text-gray-400 dark:text-slate-500">{unallocated.toFixed(1)}% unallocated</p>
                  )}
                  {overAllocated && (
                    <p className="text-xs text-red-500">Over by {(totalTargetPct - 100).toFixed(1)}%</p>
                  )}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary of trades */}
      {trades.some((t) => t.targetPct > 0 && Math.abs(t.delta) > 50) && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Trade Summary</h3>
          <div className="space-y-1.5">
            {trades
              .filter((t) => t.targetPct > 0 && Math.abs(t.delta) > 50 && !(buyOnly && t.action === 'sell'))
              .map((t) => (
                <div key={t.ticker} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-slate-300">
                    <span className={`font-semibold ${t.action === 'buy' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {t.action === 'buy' ? 'Buy' : 'Sell'}
                    </span>{' '}
                    {t.ticker}
                  </span>
                  <span className={`font-medium ${t.action === 'buy' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(Math.abs(t.delta), currency)}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Save button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Targets are saved per portfolio and persist between sessions.
        </p>
        <button
          onClick={saveTargets}
          disabled={saving || !dirty}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save targets'}
        </button>
      </div>
    </div>
  )
}
