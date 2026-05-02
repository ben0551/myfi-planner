'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { formatDate, formatCurrency } from '@/lib/formatters'

interface PendingTx {
  id: string
  source: string
  transactionType: string | null
  ticker: string | null
  quantity: number | null
  price: number | null
  fees: number | null
  tradeDate: string | null
  parseConfidence: number | null
  parseWarnings: string | null
  status: string
  portfolioId: string | null
  portfolio: { name: string } | null
  receivedAt: string
}

interface Portfolio {
  id: string
  name: string
}

interface CashAccount {
  id: string
  name: string
  institution: string | null
  balance: number
  currency: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface PendingListProps {
  portfolios: Portfolio[]
  cashAccounts: CashAccount[]
}

function parseWarnings(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as string[]
    if (typeof parsed === 'string') return [parsed]
  } catch {
    // plain string (e.g. "Franking: 30%")
    return [raw]
  }
  return []
}

function frankingFromWarnings(raw: string | null): number | null {
  const m = raw?.match(/Franking:\s*(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

function dividendTotal(item: PendingTx): number | null {
  if (item.quantity != null && item.price != null) return item.quantity * item.price
  return null
}

export function PendingList({ portfolios, cashAccounts }: PendingListProps) {
  const { data: rawItems = [], mutate } = useSWR<PendingTx[]>(
    '/api/pending-transactions?status=PENDING',
    fetcher,
    { refreshInterval: 10000 }
  )
  // Sort by trade date ascending (oldest first), fall back to receivedAt
  const items = [...rawItems].sort((a, b) => {
    const da = a.tradeDate ?? a.receivedAt
    const db = b.tradeDate ?? b.receivedAt
    return new Date(da).getTime() - new Date(db).getTime()
  })

  const [portfolioMap, setPortfolioMap] = useState<Record<string, string>>({})
  const [typeOverrides, setTypeOverrides] = useState<Record<string, string>>({})
  const [frankingOverrides, setFrankingOverrides] = useState<Record<string, string>>({})
  const [cashAccountId, setCashAccountId] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  function getFranking(item: PendingTx): string {
    if (frankingOverrides[item.id] !== undefined) return frankingOverrides[item.id]
    const parsed = frankingFromWarnings(item.parseWarnings)
    return parsed != null ? String(parsed) : ''
  }

  function getType(item: PendingTx) {
    return typeOverrides[item.id] ?? item.transactionType ?? 'DIVIDEND'
  }

  async function confirm(item: PendingTx) {
    const pid = portfolioMap[item.id] ?? item.portfolioId ?? portfolios[0]?.id
    if (!pid) return
    const type = getType(item)
    setConfirming(item.id)
    const frankingVal = getFranking(item)
    await fetch(`/api/pending-transactions/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'confirm',
        portfolioId: pid,
        cashAccountId: type === 'DIVIDEND' && cashAccountId ? cashAccountId : undefined,
        overrides: {
          transactionType: type,
          frankingPct: frankingVal !== '' ? Number(frankingVal) : 0,
        },
      }),
    })
    mutate()
    setConfirming(null)
  }

  async function reject(id: string) {
    await fetch(`/api/pending-transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    })
    mutate()
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No pending transactions. Paste an email or forward to the SMTP server.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Global cash account selector */}
      {cashAccounts.length > 0 && items.some((i) => i.transactionType === 'DIVIDEND') && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <label className="text-sm text-gray-600 shrink-0">Deposit cash dividends to:</label>
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
      )}

      {items.map((item) => {
        const warnings = parseWarnings(item.parseWarnings)
        const franking = frankingFromWarnings(item.parseWarnings)
        const confidence = item.parseConfidence ?? 0
        const confVariant = confidence >= 0.8 ? 'green' : confidence >= 0.5 ? 'yellow' : 'red'
        const type = getType(item)
        const isDividend = type === 'DIVIDEND' || type === 'DRP'
        const total = isDividend ? dividendTotal(item) : null

        return (
          <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {item.transactionType && (
                  <Badge variant={item.transactionType === 'BUY' ? 'blue' : item.transactionType === 'SELL' ? 'red' : 'green'}>
                    {item.transactionType}
                  </Badge>
                )}
                {item.ticker && (
                  <span className="font-semibold text-gray-900">{item.ticker}</span>
                )}
                {/* BUY/SELL: show qty @ price */}
                {item.quantity != null && item.price != null && !isDividend && (
                  <span className="text-sm text-gray-600">
                    {item.quantity} @ {formatCurrency(item.price, 'AUD')}
                  </span>
                )}
                {/* DIVIDEND: show per-share × qty = total */}
                {isDividend && item.price != null && (
                  <span className="text-sm text-gray-600">
                    {formatCurrency(item.price, 'AUD')}/share
                    {item.quantity != null && (
                      <> × {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 0 })} shares</>
                    )}
                    {total != null && (
                      <span className="ml-1 font-semibold text-emerald-700">= {formatCurrency(total, 'AUD')}</span>
                    )}
                  </span>
                )}
                {/* franking shown inline as editable badge */}
                {item.tradeDate && (
                  <span className="text-xs text-gray-500">{formatDate(item.tradeDate)}</span>
                )}
              </div>
              <Badge variant={confVariant as 'green' | 'yellow' | 'red'}>
                {Math.round(confidence * 100)}%
              </Badge>
            </div>

            {/* Non-franking warnings */}
            {warnings.filter((w) => !w.startsWith('Franking')).length > 0 && (
              <div className="text-xs text-yellow-700 space-y-0.5">
                {warnings.filter((w) => !w.startsWith('Franking')).map((w, i) => (
                  <p key={i}>⚠ {w}</p>
                ))}
              </div>
            )}

            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <Select
                  label="Assign to portfolio"
                  value={portfolioMap[item.id] ?? item.portfolioId ?? portfolios[0]?.id ?? ''}
                  onChange={(e) => setPortfolioMap((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  options={portfolios.map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>

              {/* Type + franking for dividend-type transactions */}
              {(item.transactionType === 'DIVIDEND' || item.transactionType === 'DRP') && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Type</label>
                    <select
                      value={type}
                      onChange={(e) => setTypeOverrides((o) => ({ ...o, [item.id]: e.target.value }))}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    >
                      <option value="DIVIDEND">Dividend (cash)</option>
                      <option value="DRP">DRP (reinvested)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Franking %</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={getFranking(item)}
                        onChange={(e) => setFrankingOverrides((o) => ({ ...o, [item.id]: e.target.value }))}
                        className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        placeholder="0"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  </div>
                </>
              )}

              <Button size="sm" onClick={() => confirm(item)} loading={confirming === item.id}>
                Confirm
              </Button>
              <Button size="sm" variant="danger" onClick={() => reject(item.id)}>
                Reject
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
