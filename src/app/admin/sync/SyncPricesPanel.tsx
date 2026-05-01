'use client'

import { useState, useRef } from 'react'

interface CoverageRow {
  ticker: string
  points: number
  from: string | null
  to: string | null
}

interface FundamentalsRow {
  ticker: string
  fetchedAt: Date
  companyName: string | null
  sector: string | null
  peRatio: number | null
  eps: number | null
  dividendYield: number | null
  marketCap: string | null
  extras: string | null
}

interface FundamentalsResult {
  tickers: number
  synced: number
  errors: number
  errorDetails?: string[]
}

interface BatchSyncResult {
  synced: number
  errors: number
  deleted?: number
  batchSize: number
  stillNeverSynced: number
  errorDetails?: string[]
  error?: string
}

interface Props {
  tickers: string[]
  coverage: CoverageRow[]
  priceCacheCount: number
  fundamentals: FundamentalsRow[]
  hasFmpKey: boolean
}

interface SyncResult {
  tickers: number
  synced: number
  updated: number
  skipped: number
  errors: number
  errorDetails?: string[]
}

interface PriceRow {
  date: string
  close: number
  volume: number | null
}

interface PriceModal {
  ticker: string
  count: number
  prices: PriceRow[]
}

export function SyncPricesPanel({ tickers, coverage, priceCacheCount, fundamentals, hasFmpKey }: Props) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<PriceModal | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [fundRunning, setFundRunning] = useState(false)
  const [fundResult, setFundResult] = useState<FundamentalsResult | null>(null)
  const [fundError, setFundError] = useState<string | null>(null)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchSyncResult | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<{ done: number; remaining: number } | null>(null)
  const batchStopRef = useRef(false)
  const batchAbortRef = useRef<AbortController | null>(null)

  const fundMap = new Map(fundamentals.map((f) => [f.ticker, f]))

  function stopBatchSync() {
    batchStopRef.current = true
    batchAbortRef.current?.abort()
  }

  async function runBatchSync() {
    batchStopRef.current = false
    setBatchRunning(true)
    setBatchResult(null)
    setBatchError(null)
    setBatchProgress(null)

    let totalSynced = 0
    let totalErrors = 0
    let totalDeleted = 0

    try {
      while (!batchStopRef.current) {
        const controller = new AbortController()
        batchAbortRef.current = controller

        let res: Response
        try {
          res = await fetch('/api/admin/sync-asx-batch?limit=20', { method: 'POST', signal: controller.signal })
        } catch {
          break // fetch was aborted — exit cleanly
        }

        const data: BatchSyncResult = await res.json()
        if (!res.ok) { setBatchError(data.error ?? 'Batch sync failed'); break }

        totalSynced += data.synced
        totalErrors += data.errors
        totalDeleted += data.deleted ?? 0
        setBatchProgress({ done: totalSynced, remaining: data.stillNeverSynced })

        if (data.stillNeverSynced === 0 || batchStopRef.current) break

        await new Promise((r) => setTimeout(r, 600))
      }
      setBatchResult({ synced: totalSynced, errors: totalErrors, deleted: totalDeleted, batchSize: 20, stillNeverSynced: 0 })
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : 'Network error')
    } finally {
      batchAbortRef.current = null
      setBatchRunning(false)
      setBatchProgress(null)
    }
  }

  async function runFundamentalsSync() {
    setFundRunning(true)
    setFundResult(null)
    setFundError(null)
    try {
      const res = await fetch('/api/admin/sync-fundamentals', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setFundError(data.error ?? 'Sync failed'); return }
      setFundResult(data)
    } catch (err) {
      setFundError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setFundRunning(false)
    }
  }

  async function openPriceHistory(ticker: string) {
    setModalLoading(true)
    setModal(null)
    try {
      const res = await fetch(`/api/admin/price-history?ticker=${ticker}`)
      const data = await res.json()
      setModal(data)
    } catch {
      // silently fail — user can retry
    } finally {
      setModalLoading(false)
    }
  }

  async function runSync(subset?: string[]) {
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/admin/sync-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subset ? { tickers: subset } : {}),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        setError(err.error ?? 'Sync failed')
        return
      }
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setRunning(false)
    }
  }

  const missingSome = coverage.filter((c) => c.points === 0)
  const today = new Date().toISOString().split('T')[0]
  const stale = coverage.filter((c) => c.to && c.to < today && c.points > 0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Portfolio Tickers" value={tickers.length} />
        <StatCard label="With History" value={coverage.filter((c) => c.points > 0).length} />
        <StatCard label="Missing History" value={missingSome.length} color={missingSome.length > 0 ? 'amber' : 'gray'} />
        <StatCard label="Price Cache Entries" value={priceCacheCount} />
      </div>

      {/* Action buttons */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Sync Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runSync()}
            disabled={running}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? 'Syncing…' : 'Sync All Tickers'}
          </button>
          {missingSome.length > 0 && (
            <button
              onClick={() => runSync(missingSome.map((c) => c.ticker))}
              disabled={running}
              className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              Sync {missingSome.length} Missing Only
            </button>
          )}
          {stale.length > 0 && (
            <button
              onClick={() => runSync(stale.map((c) => c.ticker))}
              disabled={running}
              className="px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors"
            >
              Update {stale.length} Stale
            </button>
          )}
        </div>

        {running && (
          <div className="mt-4 flex items-center gap-2 text-sm text-indigo-600">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Fetching price history from Yahoo Finance… this may take a minute for large portfolios.
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4">
            <p className="text-sm font-semibold text-green-800 mb-2">Sync complete</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-500">Tickers:</span> <strong>{result.tickers}</strong></div>
              <div><span className="text-gray-500">Full fetch:</span> <strong className="text-indigo-700">{result.synced}</strong></div>
              <div><span className="text-gray-500">Updated:</span> <strong className="text-sky-700">{result.updated}</strong></div>
              <div><span className="text-gray-500">Skipped:</span> <strong>{result.skipped}</strong></div>
              {result.errors > 0 && (
                <div className="col-span-full">
                  <span className="text-red-600 font-medium">{result.errors} errors</span>
                  {result.errorDetails && (
                    <ul className="mt-1 text-xs text-red-500 space-y-0.5">
                      {result.errorDetails.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Price history modal */}
      {(modalLoading || modal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setModal(null) }}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {modal ? `${modal.ticker} — Price History` : 'Loading…'}
                </h2>
                {modal && (
                  <p className="text-xs text-gray-500 mt-0.5">{modal.count.toLocaleString()} trading days</p>
                )}
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {modalLoading && (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading…</div>
            )}

            {modal && (
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                    <tr className="text-xs text-gray-500 uppercase tracking-wide text-left">
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium text-right">Close (AUD)</th>
                      <th className="px-4 py-3 font-medium text-right">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {modal.prices.map((p) => (
                      <tr key={p.date} className="hover:bg-gray-50">
                        <td className="px-6 py-2.5 text-gray-700 tabular-nums">{p.date}</td>
                        <td className="px-4 py-2.5 text-right text-gray-900 tabular-nums font-medium">
                          ${p.close.toFixed(3)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">
                          {p.volume != null ? p.volume.toLocaleString() : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Portfolio batch fundamentals sync */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Batch Fundamentals Sync</h2>
          <p className="text-xs text-gray-400">
            Syncs fundamentals (P/E, EPS, market cap, ROE, etc.) for all portfolio, watchlist, and alert tickers
            via Yahoo Finance and FMP. Runs in batches of 20 until all tickers are covered.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {batchRunning ? (
            <button
              onClick={stopBatchSync}
              className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={runBatchSync}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
            >
              Sync All Remaining
            </button>
          )}
        </div>

        {batchRunning && batchProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="text-violet-600 font-medium">{batchProgress.done.toLocaleString()} synced</span>
              <span>{batchProgress.remaining.toLocaleString()} remaining</span>
            </div>
            {batchProgress.remaining + batchProgress.done > 0 && (
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${(batchProgress.done / (batchProgress.done + batchProgress.remaining)) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}
        {batchRunning && !batchProgress && (
          <p className="text-sm text-violet-600 animate-pulse">Starting sync…</p>
        )}
        {batchResult && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
            Done — synced {batchResult.synced.toLocaleString()} tickers.
            {(batchResult.deleted ?? 0) > 0 && (
              <span className="ml-1 text-gray-600">{batchResult.deleted} removed (no data found).</span>
            )}
            {batchResult.errors > 0 && (
              <span className="ml-1 text-red-600">{batchResult.errors} errors.</span>
            )}
          </div>
        )}
        {batchError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{batchError}</div>
        )}
      </div>

      {/* Fundamentals sync */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Portfolio Fundamentals Sync</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Fetches P/E, EPS, margins, ROE, revenue and more from FMP for every portfolio ticker.
              {!hasFmpKey && <span className="text-amber-600 ml-1">Set your FMP API key in Admin → Settings first.</span>}
            </p>
          </div>
          <button
            onClick={runFundamentalsSync}
            disabled={fundRunning || !hasFmpKey}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {fundRunning ? 'Syncing…' : 'Sync Fundamentals'}
          </button>
        </div>

        {fundRunning && (
          <div className="flex items-center gap-2 text-sm text-violet-600 mb-3">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Fetching fundamentals from FMP…
          </div>
        )}
        {fundResult && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800 mb-3">
            Done — {fundResult.synced}/{fundResult.tickers} tickers synced.
            {fundResult.errors > 0 && <span className="text-red-600 ml-2">{fundResult.errors} errors.</span>}
          </div>
        )}
        {fundError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-3">{fundError}</div>
        )}

        {fundamentals.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500 uppercase tracking-wide">
                  <th className="pb-2 font-medium">Ticker</th>
                  <th className="pb-2 font-medium">Company</th>
                  <th className="pb-2 font-medium">Sector</th>
                  <th className="pb-2 font-medium text-right">Market Cap</th>
                  <th className="pb-2 font-medium text-right">P/E</th>
                  <th className="pb-2 font-medium text-right">EPS</th>
                  <th className="pb-2 font-medium text-right">Div Yield</th>
                  <th className="pb-2 font-medium text-right">ROE</th>
                  <th className="pb-2 font-medium text-right">Net Margin</th>
                  <th className="pb-2 font-medium text-gray-400">Last Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tickers.map((ticker) => {
                  const f = fundMap.get(ticker)
                  const extras = f?.extras ? JSON.parse(f.extras) as Record<string, number> : {}
                  return (
                    <tr key={ticker} className="hover:bg-gray-50">
                      <td className="py-2 font-semibold text-gray-900">{ticker}</td>
                      <td className="py-2 text-gray-600 max-w-[140px] truncate">{f?.companyName ?? <span className="text-gray-300">—</span>}</td>
                      <td className="py-2 text-gray-500">{f?.sector ?? <span className="text-gray-300">—</span>}</td>
                      <td className="py-2 text-right text-gray-700">{f?.marketCap ?? <span className="text-gray-300">—</span>}</td>
                      <td className="py-2 text-right text-gray-700">{f?.peRatio != null ? f.peRatio.toFixed(1) : <span className="text-gray-300">—</span>}</td>
                      <td className="py-2 text-right text-gray-700">{f?.eps != null ? `$${f.eps.toFixed(3)}` : <span className="text-gray-300">—</span>}</td>
                      <td className="py-2 text-right text-gray-700">{f?.dividendYield != null ? `${f.dividendYield.toFixed(2)}%` : <span className="text-gray-300">—</span>}</td>
                      <td className="py-2 text-right text-gray-700">{extras.roe != null ? `${(extras.roe * 100).toFixed(1)}%` : <span className="text-gray-300">—</span>}</td>
                      <td className="py-2 text-right text-gray-700">{extras.netMargin != null ? `${(extras.netMargin * 100).toFixed(1)}%` : <span className="text-gray-300">—</span>}</td>
                      <td className="py-2 text-gray-400">{f ? new Date(f.fetchedAt).toLocaleDateString('en-AU') : <span className="text-gray-300">Never</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {fundamentals.length === 0 && hasFmpKey && (
          <p className="text-sm text-gray-400 text-center py-4">No fundamentals synced yet — click Sync Fundamentals to fetch.</p>
        )}
      </div>

      {/* Coverage table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">History Coverage</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 font-medium">Ticker</th>
                <th className="px-4 py-3 font-medium text-right">Price Records</th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">To</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coverage.map((c) => {
                const isStale = c.to && c.to < today && c.points > 0
                const isMissing = c.points === 0
                return (
                  <tr key={c.ticker} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-semibold text-gray-900">{c.ticker}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {c.points > 0 ? (
                        <button
                          onClick={() => openPriceHistory(c.ticker)}
                          className="text-indigo-600 hover:underline font-medium"
                        >
                          {c.points.toLocaleString()}
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.from ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.to ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      {isMissing ? (
                        <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">No data</span>
                      ) : isStale ? (
                        <span className="text-xs rounded-full bg-sky-100 text-sky-700 px-2 py-0.5">Stale</span>
                      ) : (
                        <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-0.5">Up to date</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color = 'gray' }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    gray: 'text-gray-900',
    amber: 'text-amber-700',
    green: 'text-green-700',
    indigo: 'text-indigo-700',
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorMap[color] ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}
