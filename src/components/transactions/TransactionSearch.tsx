'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters'

interface Transaction {
  id: string
  type: string
  ticker: string
  date: string
  quantity: string | number
  price: string | number
  fees: string | number
  amount: string | number | null
  notes: string | null
  portfolioId: string
  portfolio: { name: string; currency: string }
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const typeBadge: Record<string, 'blue' | 'red' | 'green'> = {
  BUY: 'blue',
  SELL: 'red',
  DIVIDEND: 'green',
}

export function TransactionSearch() {
  const [ticker, setTicker] = useState('')
  const [type, setType] = useState('')

  const { data, error } = useSWR<Transaction[]>('/api/transactions', fetcher)

  const filtered = useMemo(() => {
    if (!data) return []
    return data.filter((tx) => {
      if (ticker && !tx.ticker.toLowerCase().includes(ticker.toLowerCase())) return false
      if (type && tx.type !== type) return false
      return true
    })
  }, [data, ticker, type])

  const summary = useMemo(() => {
    if (!filtered.length) return null
    const buys = filtered.filter((t) => t.type === 'BUY').length
    const sells = filtered.filter((t) => t.type === 'SELL').length
    const divs = filtered.filter((t) => t.type === 'DIVIDEND').length
    return { buys, sells, divs }
  }, [filtered])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-36">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. VAS"
              className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All types</option>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
              <option value="DIVIDEND">Dividend</option>
            </select>
          </div>
          {(ticker || type) && (
            <div className="flex items-end">
              <button
                onClick={() => { setTicker(''); setType('') }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Results */}
      {error && (
        <div className="text-sm text-red-500 py-4">Failed to load transactions.</div>
      )}

      {!data && (
        <div className="text-sm text-gray-400 py-8 text-center animate-pulse">Loading...</div>
      )}

      {data && (
        <>
          {summary && (
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
              <span>{filtered.length} transactions</span>
              {summary.buys > 0 && <span className="text-blue-600">{summary.buys} buys</span>}
              {summary.sells > 0 && <span className="text-red-600">{summary.sells} sells</span>}
              {summary.divs > 0 && <span className="text-green-600">{summary.divs} dividends</span>}
            </div>
          )}

          <Card padding={false}>
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                No transactions match your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      <th className="px-6 pb-3 pt-4 font-medium">Date</th>
                      <th className="pb-3 pt-4 pr-4 font-medium">Type</th>
                      <th className="pb-3 pt-4 pr-4 font-medium">Ticker</th>
                      <th className="pb-3 pt-4 pr-4 font-medium">Portfolio</th>
                      <th className="pb-3 pt-4 pr-4 font-medium text-right">Qty</th>
                      <th className="pb-3 pt-4 pr-4 font-medium text-right">Price</th>
                      <th className="pb-3 pt-4 pr-4 font-medium text-right">Fees</th>
                      <th className="pb-3 pt-4 pr-6 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {filtered.map((tx) => {
                      const currency = tx.portfolio.currency
                      const qty = Number(tx.quantity)
                      const price = Number(tx.price)
                      const fees = Number(tx.fees)
                      const amount = tx.amount !== null ? Number(tx.amount) : null
                      const total =
                        tx.type === 'DIVIDEND'
                          ? amount
                          : tx.type === 'BUY'
                          ? qty * price + fees
                          : qty * price - fees

                      return (
                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                          <td className="px-6 py-3 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(tx.date, 'short')}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant={typeBadge[tx.type] ?? 'gray'}>{tx.type}</Badge>
                          </td>
                          <td className="py-3 pr-4 font-semibold text-gray-900 dark:text-white">
                            <Link
                              href={`/research/${tx.ticker}`}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              {tx.ticker}
                            </Link>
                          </td>
                          <td className="py-3 pr-4 text-gray-500 dark:text-slate-400 text-xs">
                            <Link
                              href={`/portfolios/${tx.portfolioId}`}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              {tx.portfolio.name}
                            </Link>
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                            {tx.type === 'DIVIDEND' ? '—' : formatNumber(qty, 0)}
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-700 dark:text-slate-300">
                            {tx.type === 'DIVIDEND' ? '—' : formatCurrency(price, currency)}
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-500 dark:text-slate-400">
                            {fees > 0 ? formatCurrency(fees, currency) : '—'}
                          </td>
                          <td className="py-3 pr-6 text-right font-medium text-gray-900 dark:text-white">
                            {formatCurrency(total ?? 0, currency)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
