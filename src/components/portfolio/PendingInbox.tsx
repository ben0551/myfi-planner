'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/formatters'

export interface CashAccountOption {
  id: string
  name: string
  institution: string | null
  balance: number
  currency: string
}

interface PendingItem {
  id: string
  source: string
  transactionType: string | null
  ticker: string | null
  quantity: number | null  // shares held at ex-date
  price: number | null     // per-share dividend amount
  fees: number | null
  currency: string | null
  tradeDate: string | null
  parseWarnings: string | null
  rawContent: string
}

interface Props {
  items: PendingItem[]
  portfolioId: string
  cashAccounts: CashAccountOption[]
  drpTickers?: Record<string, boolean>
  currentPrices?: Record<string, number>
}

function totalAmount(item: PendingItem) {
  if (item.quantity != null && item.price != null) return item.quantity * item.price
  return null
}

function formatTradeDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function PendingInbox({ items: initialItems, portfolioId, cashAccounts, drpTickers = {}, currentPrices = {} }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  // Per-item type override: 'DIVIDEND' | 'DRP'
  const [typeOverrides, setTypeOverrides] = useState<Record<string, string>>({})
  // Per-item franking credit overrides — dollar amounts, not percentages
  const [frankingOverrides, setFrankingOverrides] = useState<Record<string, string>>({})
  // Per-item DRP share price override (defaults to currentPrices[ticker])
  const [drpPriceOverrides, setDrpPriceOverrides] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [bulkLoading, setBulkLoading] = useState(false)
  const [cashAccountId, setCashAccountId] = useState('')

  // Returns franking credit dollar amount for an item.
  // Default: compute from frankingPct in parseWarnings × total dividend × 30/70.
  function getFrankingCredit(item: PendingItem): string {
    if (frankingOverrides[item.id] !== undefined) return frankingOverrides[item.id]
    const m = item.parseWarnings?.match(/Franking:\s*(\d+)/)
    if (!m) return ''
    const pct = parseInt(m[1], 10)
    const total = totalAmount(item)
    if (!total || pct === 0) return ''
    const credit = total * (pct / 100) * (30 / 70)
    return credit.toFixed(2)
  }

  function getDrpSharePrice(item: PendingItem): string {
    if (drpPriceOverrides[item.id] !== undefined) return drpPriceOverrides[item.id]
    const cp = item.ticker ? currentPrices[item.ticker] : undefined
    return cp != null ? cp.toFixed(4) : ''
  }

  function getDrpNewShares(item: PendingItem): number | null {
    const total = item.quantity != null && item.price != null ? item.quantity * item.price : null
    if (total == null) return null
    const priceStr = getDrpSharePrice(item)
    const sharePrice = parseFloat(priceStr)
    if (!sharePrice || sharePrice <= 0) return null
    return Math.round((total / sharePrice) * 10000) / 10000
  }

  const currency = items[0]?.currency ?? 'AUD'

  function getType(item: PendingItem) {
    if (typeOverrides[item.id] !== undefined) return typeOverrides[item.id]
    if (item.ticker && drpTickers[item.ticker]) return 'DRP'
    return item.transactionType ?? 'DIVIDEND'
  }

  async function confirmItem(item: PendingItem) {
    setLoading((l) => ({ ...l, [item.id]: true }))
    const type = getType(item)
    try {
      const creditStr = getFrankingCredit(item)
      const overrides: Record<string, unknown> = {
        transactionType: type,
        frankingCredit: creditStr !== '' ? Number(creditStr) : 0,
      }
      // Pass DRP share price so the server can compute new shares = total_div / drp_price
      if (type === 'DRP') {
        const priceStr = getDrpSharePrice(item)
        if (priceStr) overrides.drpSharePrice = Number(priceStr)
      }
      await fetch(`/api/pending-transactions/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          portfolioId,
          cashAccountId: type === 'DIVIDEND' && cashAccountId ? cashAccountId : undefined,
          overrides,
        }),
      })
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } finally {
      setLoading((l) => ({ ...l, [item.id]: false }))
    }
  }

  async function rejectItem(id: string) {
    setLoading((l) => ({ ...l, [id]: true }))
    try {
      await fetch(`/api/pending-transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })
      setItems((prev) => prev.filter((i) => i.id !== id))
    } finally {
      setLoading((l) => ({ ...l, [id]: false }))
    }
  }

  async function confirmAll() {
    setBulkLoading(true)
    for (const item of items) {
      const type = getType(item)
      await fetch(`/api/pending-transactions/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          portfolioId,
          cashAccountId: type === 'DIVIDEND' && cashAccountId ? cashAccountId : undefined,
          overrides: { transactionType: type },
        }),
      })
    }
    setItems([])
    setBulkLoading(false)
    router.refresh()
  }

  if (items.length === 0) {
    return (
      <Card className="text-center py-10 text-gray-500 text-sm">
        All done — no pending transactions.
      </Card>
    )
  }

  const totalIncome = items
    .filter((i) => getType(i) === 'DIVIDEND')
    .reduce((s, i) => s + (totalAmount(i) ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Global settings + bulk action */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Deposit cash dividends to</label>
              <select
                value={cashAccountId}
                onChange={(e) => setCashAccountId(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Do not deposit</option>
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.institution ? ` (${a.institution})` : ''} — {formatCurrency(a.balance, a.currency)}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-600 pt-4">
              <span className="font-semibold">{items.length}</span> pending ·{' '}
              total cash income{' '}
              <span className="font-semibold text-emerald-700">{formatCurrency(totalIncome, currency)}</span>
            </div>
          </div>
          <Button size="sm" onClick={confirmAll} disabled={bulkLoading}>
            {bulkLoading ? 'Confirming…' : `Confirm All ${items.length}`}
          </Button>
        </div>
      </Card>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-6 pb-3 pt-4 font-medium">Ticker</th>
                <th className="pb-3 pt-4 pr-4 font-medium">Ex-Date</th>
                <th className="pb-3 pt-4 pr-4 font-medium text-right">Shares / New</th>
                <th className="pb-3 pt-4 pr-4 font-medium text-right">Div/Share · DRP Price</th>
                <th className="pb-3 pt-4 pr-4 font-medium text-right">Total Div</th>
                <th className="pb-3 pt-4 pr-4 font-medium text-right">Franking Credits</th>
                <th className="pb-3 pt-4 pr-4 font-medium">Type</th>
                <th className="pb-3 pt-4 pr-6 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => {
                const total = totalAmount(item)
                const busy = loading[item.id]
                const type = getType(item)
                const drpNewShares = type === 'DRP' ? getDrpNewShares(item) : null
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3 px-6 font-semibold text-gray-900">{item.ticker ?? '—'}</td>
                    <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{formatTradeDate(item.tradeDate)}</td>
                    <td className="py-3 pr-4 text-right text-gray-700">
                      {type === 'DRP' ? (
                        <span className="text-indigo-700 font-medium">
                          {drpNewShares != null ? `+${drpNewShares.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '—'}
                        </span>
                      ) : (
                        item.quantity?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right text-gray-700">
                      {type === 'DRP' ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-xs text-gray-400">$</span>
                          <input
                            type="number"
                            min="0.0001"
                            step="0.01"
                            value={getDrpSharePrice(item)}
                            onChange={(e) => setDrpPriceOverrides((o) => ({ ...o, [item.id]: e.target.value }))}
                            className="w-20 text-sm border border-indigo-200 rounded px-2 py-0.5 bg-white text-gray-700 text-right focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        item.price != null ? `$${item.price.toFixed(4)}` : '—'
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-emerald-700">
                      {total != null ? formatCurrency(total, currency) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-xs text-gray-400">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getFrankingCredit(item)}
                          onChange={(e) => setFrankingOverrides((o) => ({ ...o, [item.id]: e.target.value }))}
                          className="w-20 text-sm border border-gray-200 rounded px-2 py-0.5 bg-white text-gray-700 text-right focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={type}
                        onChange={(e) => setTypeOverrides((o) => ({ ...o, [item.id]: e.target.value }))}
                        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      >
                        <option value="DIVIDEND">Dividend (cash)</option>
                        <option value="DRP">DRP (reinvested)</option>
                      </select>
                    </td>
                    <td className="py-3 pr-6">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={() => confirmItem(item)} disabled={busy}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => rejectItem(item.id)} disabled={busy}>
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
