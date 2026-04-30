'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatPercent, gainClass } from '@/lib/formatters'
import type { ScreenerResponse, ScreenerResult } from '@/app/api/screener/route'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type SortKey = 'ticker' | 'price' | 'changePct' | 'dividendYield' | 'peRatio' | 'marketCap'

function parseMarketCap(mc: string | null): number {
  if (!mc) return 0
  const s = mc.replace(/[$,\s]/g, '').toUpperCase()
  if (s.endsWith('T')) return parseFloat(s) * 1e12
  if (s.endsWith('B')) return parseFloat(s) * 1e9
  if (s.endsWith('M')) return parseFloat(s) * 1e6
  return parseFloat(s) || 0
}

function SortTh({
  col, current, dir, onSort, children, className,
}: {
  col: SortKey; current: SortKey; dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void; children: React.ReactNode; className?: string
}) {
  const active = col === current
  return (
    <th className={`px-4 py-3 font-medium ${className ?? ''}`}>
      <button
        onClick={() => onSort(col)}
        className={`flex items-center gap-1 text-xs uppercase tracking-wide ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
      >
        {children}
        <span className="opacity-60">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  )
}

export function StockScreener() {
  const [search, setSearch] = useState('')
  const [minYield, setMinYield] = useState('')
  const [maxPE, setMaxPE] = useState('')
  const [sector, setSector] = useState('')
  const [onWatchlistOnly, setOnWatchlistOnly] = useState(false)
  const [holdingsOnly, setHoldingsOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('dividendYield')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [togglingTicker, setTogglingTicker] = useState<string | null>(null)

  const params = new URLSearchParams()
  if (minYield) params.set('minYield', minYield)
  if (maxPE) params.set('maxPE', maxPE)
  if (sector) params.set('sector', sector)
  if (onWatchlistOnly) params.set('onWatchlist', 'true')
  if (holdingsOnly) params.set('holdings', 'true')
  // Pass fundOnly=false only when user explicitly wants unsynced tickers too
  // (default is true — only show tickers with fundamentals data)

  const { data, isLoading, mutate } = useSWR<ScreenerResponse>(
    `/api/screener?${params}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const sectors = data?.sectors ?? []

  const rows = useMemo(() => {
    if (!data?.results) return []
    const q = search.toUpperCase().trim()
    let list = data.results
    if (q) {
      list = list.filter(
        (r) => r.ticker.includes(q) || r.companyName?.toUpperCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (sortKey === 'ticker') {
        const cmp = a.ticker.localeCompare(b.ticker)
        return sortDir === 'asc' ? cmp : -cmp
      }
      let av: number, bv: number
      switch (sortKey) {
        case 'price':         av = a.price ?? 0;            bv = b.price ?? 0;            break
        case 'changePct':     av = a.changePct ?? -999;     bv = b.changePct ?? -999;     break
        case 'dividendYield': av = a.dividendYield ?? 0;    bv = b.dividendYield ?? 0;    break
        case 'peRatio':       av = a.peRatio ?? 9999;       bv = b.peRatio ?? 9999;       break
        case 'marketCap':     av = parseMarketCap(a.marketCap); bv = parseMarketCap(b.marketCap); break
        default:              av = 0; bv = 0
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [data, search, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'ticker' ? 'asc' : 'desc') }
  }

  async function toggleWatchlist(r: ScreenerResult) {
    setTogglingTicker(r.ticker)
    try {
      if (r.onWatchlist && r.watchlistId) {
        await fetch(`/api/watchlist/${r.watchlistId}`, { method: 'DELETE' })
      } else {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: r.ticker }),
        })
      }
      mutate()
    } finally {
      setTogglingTicker(null)
    }
  }

  const { totalInDb = 0, fundAvailableCount = 0 } = data ?? {}
  const hasFilters = !!(minYield || maxPE || sector || onWatchlistOnly || holdingsOnly || search)

  return (
    <div className="space-y-4">
      {/* Coverage banner */}
      {totalInDb > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 px-1">
          <span>
            {fundAvailableCount.toLocaleString()} of {totalInDb.toLocaleString()} ASX stocks have synced fundamentals
            {fundAvailableCount < totalInDb && (
              <> · <Link href="/admin/sync" className="text-indigo-500 hover:underline">Sync more →</Link></>
            )}
          </span>
          {data && (
            <span>{rows.length.toLocaleString()} result{rows.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ticker or company name"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Min Yield %</label>
            <input
              type="number"
              value={minYield}
              onChange={(e) => setMinYield(e.target.value)}
              placeholder="e.g. 3"
              min="0" step="0.5"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Max P/E</label>
            <input
              type="number"
              value={maxPE}
              onChange={(e) => setMaxPE(e.target.value)}
              placeholder="e.g. 20"
              min="0" step="1"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Sector</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All sectors</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2 justify-end">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={holdingsOnly}
                onChange={(e) => setHoldingsOnly(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Holdings only
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onWatchlistOnly}
                onChange={(e) => setOnWatchlistOnly(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Watchlist only
            </label>
          </div>
        </div>
      </Card>

      {/* Empty / loading states */}
      {isLoading ? (
        <div className="text-center py-12 text-sm text-gray-400 dark:text-slate-500 animate-pulse">Loading…</div>
      ) : rows.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <p className="font-medium text-gray-500 dark:text-slate-400">No results</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
              {!hasFilters && fundAvailableCount === 0
                ? <>No fundamentals data yet. <Link href="/admin/sync" className="text-indigo-500 hover:underline">Import the ASX list and run a batch sync →</Link></>
                : 'Try adjusting the filters.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 dark:border-slate-700 text-left">
                <tr>
                  <SortTh col="ticker"        current={sortKey} dir={sortDir} onSort={handleSort}>Ticker</SortTh>
                  <SortTh col="price"         current={sortKey} dir={sortDir} onSort={handleSort} className="text-right">Price</SortTh>
                  <SortTh col="changePct"     current={sortKey} dir={sortDir} onSort={handleSort} className="text-right">Chg%</SortTh>
                  <SortTh col="dividendYield" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right">Yield</SortTh>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400 hidden sm:table-cell">Frank%</th>
                  <SortTh col="peRatio"       current={sortKey} dir={sortDir} onSort={handleSort} className="text-right">P/E</SortTh>
                  <SortTh col="marketCap"     current={sortKey} dir={sortDir} onSort={handleSort} className="text-right hidden md:table-cell">Mkt Cap</SortTh>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400 hidden lg:table-cell">Sector</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.ticker} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/research/${r.ticker}`}
                          className="font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {r.ticker}
                        </Link>
                        {r.isHeld && (
                          <span className="text-xs px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-full font-medium">Held</span>
                        )}
                      </div>
                      {r.companyName && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate max-w-[180px]">{r.companyName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">
                      {r.price != null ? formatCurrency(r.price, 'AUD') : <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.changePct != null
                        ? <span className={`font-medium ${gainClass(r.changePct)}`}>{formatPercent(r.changePct)}</span>
                        : <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">
                      {r.dividendYield != null ? `${r.dividendYield.toFixed(2)}%` : <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400 hidden sm:table-cell">
                      {r.frankingPct != null ? `${r.frankingPct}%` : <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">
                      {r.peRatio != null ? r.peRatio.toFixed(1) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400 hidden md:table-cell">
                      {r.marketCap ?? <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs hidden lg:table-cell truncate max-w-[120px]">
                      {r.sector ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleWatchlist(r)}
                        disabled={togglingTicker === r.ticker}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap disabled:opacity-50 ${
                          r.onWatchlist
                            ? 'border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                            : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                      >
                        {r.onWatchlist ? '★ Watching' : '+ Watch'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
