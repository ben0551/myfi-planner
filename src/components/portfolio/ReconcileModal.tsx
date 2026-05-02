'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { formatNumber } from '@/lib/formatters'
import type { Holding } from '@/lib/types'

interface Props {
  portfolioId: string
  holdings: Holding[]
}

export function ReconcileModal({ portfolioId, holdings }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [actuals, setActuals] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ticker: string; diff: number }[] | null>(null)

  function getDiff(ticker: string): number | null {
    const val = actuals[ticker]
    if (val === '' || val === undefined) return null
    const actual = parseFloat(val)
    if (isNaN(actual)) return null
    const system = holdings.find(h => h.ticker === ticker)?.quantity ?? 0
    return Math.round((actual - system) * 1e6) / 1e6
  }

  const anyDiff = holdings.some(h => {
    const d = getDiff(h.ticker)
    return d !== null && Math.abs(d) >= 0.0001
  })

  async function apply() {
    setLoading(true)
    setResult(null)
    const adjustments = holdings
      .map(h => ({ ticker: h.ticker, actualQty: parseFloat(actuals[h.ticker] ?? '') }))
      .filter(a => !isNaN(a.actualQty))

    const res = await fetch(`/api/portfolios/${portfolioId}/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustments }),
    })
    const data = await res.json()
    setResult(data.created ?? [])
    setLoading(false)
    if (data.created?.length > 0) {
      router.refresh()
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Reconcile
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Reconcile Holdings</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Enter actual share quantities from your broker/CHESS statement. Adjustments are created as BUY/SELL transactions at today&apos;s market price.
            </p>
          </div>
          <button
            onClick={() => { setOpen(false); setResult(null) }}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {result ? (
            <div className="space-y-3">
              {result.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-slate-300">No adjustments needed — all quantities matched.</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-slate-300">
                    Created {result.length} adjustment transaction{result.length !== 1 ? 's' : ''}:
                  </p>
                  {result.map(r => (
                    <div key={r.ticker} className="flex items-center gap-3 text-sm">
                      <span className="font-semibold w-16">{r.ticker}</span>
                      <span className={r.diff > 0 ? 'text-emerald-700' : 'text-red-600'}>
                        {r.diff > 0 ? '+' : ''}{r.diff.toFixed(4)} shares ({r.diff > 0 ? 'BUY' : 'SELL'})
                      </span>
                    </div>
                  ))}
                </>
              )}
              <Button size="sm" onClick={() => { setResult(null); setActuals({}) }}>
                Reconcile again
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="pb-2 font-medium">Ticker</th>
                  <th className="pb-2 font-medium text-right">System Qty</th>
                  <th className="pb-2 font-medium text-right">Actual Qty</th>
                  <th className="pb-2 font-medium text-right">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {holdings.map(h => {
                  const diff = getDiff(h.ticker)
                  const hasDiff = diff !== null && Math.abs(diff) >= 0.0001
                  return (
                    <tr key={h.ticker}>
                      <td className="py-2.5 font-semibold text-gray-900 dark:text-white pr-4">{h.ticker}</td>
                      <td className="py-2.5 text-right text-gray-600 dark:text-slate-300 pr-4 font-mono">
                        {formatNumber(h.quantity, 4)}
                      </td>
                      <td className="py-2.5 text-right pr-4">
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={actuals[h.ticker] ?? ''}
                          onChange={e => setActuals(a => ({ ...a, [h.ticker]: e.target.value }))}
                          placeholder={formatNumber(h.quantity, 4)}
                          className="w-28 text-sm border border-gray-200 dark:border-slate-600 rounded px-2 py-0.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-right font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </td>
                      <td className={`py-2.5 text-right font-mono text-sm font-medium ${
                        !hasDiff ? 'text-gray-300' :
                        diff! > 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}>
                        {hasDiff
                          ? `${diff! > 0 ? '+' : ''}${diff!.toFixed(4)}`
                          : diff === null ? '—' : '✓'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!result && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3">
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={apply} disabled={!anyDiff || loading} loading={loading}>
              Apply adjustments
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
