'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatPercent, gainClass } from '@/lib/formatters'

interface WatchlistEntry {
  id: string
  ticker: string
  targetPrice: number | null
  notes: string | null
  createdAt: string
  price: number | null
  change: number | null
  changePct: number | null
  companyName: string | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function WatchlistDashboard() {
  const { data: items = [], mutate, isLoading } = useSWR<WatchlistEntry[]>('/api/watchlist', fetcher, {
    refreshInterval: 60000,
  })

  const [ticker, setTicker] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState('')
  const [editNotes, setEditNotes] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!ticker.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          targetPrice: targetPrice ? parseFloat(targetPrice) : null,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to add')
        return
      }
      setTicker('')
      setTargetPrice('')
      setNotes('')
      mutate()
      toast.success('Added to watchlist')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/watchlist/${id}`, { method: 'DELETE' })
    mutate()
    toast.success('Removed from watchlist')
  }

  async function handleSaveEdit(id: string) {
    await fetch(`/api/watchlist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPrice: editTarget ? parseFloat(editTarget) : null,
        notes: editNotes.trim() || null,
      }),
    })
    setEditId(null)
    mutate()
  }

  function startEdit(item: WatchlistEntry) {
    setEditId(item.id)
    setEditTarget(item.targetPrice?.toString() ?? '')
    setEditNotes(item.notes ?? '')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Add form */}
      <div>
        <Card>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Add to Watchlist</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <Input
              label="Ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. CBA"
              required
            />
            <Input
              label="Target Price (optional)"
              type="number"
              step="0.01"
              min="0"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="e.g. 100.00"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why you're watching..."
                rows={2}
                className="block w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <Button type="submit" className="w-full" disabled={adding || !ticker.trim()}>
              {adding ? 'Adding…' : 'Add'}
            </Button>
          </form>
        </Card>
      </div>

      {/* Watchlist table */}
      <div className="lg:col-span-2">
        {isLoading && (
          <div className="text-sm text-gray-400 py-8 text-center animate-pulse">Loading…</div>
        )}

        {!isLoading && items.length === 0 && (
          <Card>
            <div className="py-10 text-center text-gray-400">
              <p className="font-medium text-gray-500 dark:text-slate-400">No tickers on your watchlist yet</p>
              <p className="text-sm mt-1">Add a ticker to track its live price and set a target.</p>
            </div>
          </Card>
        )}

        {items.length > 0 && (
          <Card padding={false}>
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {items.map((item) => {
                const atTarget =
                  item.targetPrice !== null &&
                  item.price !== null &&
                  item.price >= item.targetPrice

                return (
                  <div key={item.id} className="px-5 py-4">
                    {editId === item.id ? (
                      /* Edit row */
                      <div className="space-y-2">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.ticker}</p>
                        <div className="flex gap-2">
                          <Input
                            label="Target Price"
                            type="number"
                            step="0.01"
                            value={editTarget}
                            onChange={(e) => setEditTarget(e.target.value)}
                            placeholder="Optional"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Notes</label>
                          <textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            rows={2}
                            className="block w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveEdit(item.id)}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      /* Display row */
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/research/${item.ticker}`}
                              className="font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                            >
                              {item.ticker}
                            </Link>
                            {item.companyName && (
                              <span className="text-xs text-gray-400 truncate max-w-[160px]">{item.companyName}</span>
                            )}
                            {atTarget && (
                              <Badge variant="green">At target</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {item.price !== null ? (
                              <>
                                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                  {formatCurrency(item.price, 'AUD')}
                                </span>
                                {item.changePct !== null && (
                                  <span className={`text-sm font-medium ${gainClass(item.changePct)}`}>
                                    {formatPercent(item.changePct)}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-gray-400">Price unavailable</span>
                            )}
                            {item.targetPrice !== null && (
                              <span className="text-xs text-gray-400">
                                Target: {formatCurrency(item.targetPrice, 'AUD')}
                                {item.price !== null && (
                                  <span className={gainClass(item.price - item.targetPrice)}>
                                    {' '}({item.price >= item.targetPrice ? '+' : ''}{formatCurrency(item.price - item.targetPrice, 'AUD')})
                                  </span>
                                )}
                              </span>
                            )}
                          </div>

                          {item.notes && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{item.notes}</p>
                          )}
                        </div>

                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>Remove</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
