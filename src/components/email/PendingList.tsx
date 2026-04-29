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

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface PendingListProps {
  portfolios: Portfolio[]
}

export function PendingList({ portfolios }: PendingListProps) {
  const { data: items = [], mutate } = useSWR<PendingTx[]>(
    '/api/pending-transactions?status=PENDING',
    fetcher,
    { refreshInterval: 10000 }
  )
  const [portfolioMap, setPortfolioMap] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState<string | null>(null)

  async function confirm(id: string) {
    const pid = portfolioMap[id] ?? portfolios[0]?.id
    if (!pid) return
    setConfirming(id)
    await fetch(`/api/pending-transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', portfolioId: pid }),
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
    <div className="space-y-3">
      {items.map((item) => {
        const warnings = item.parseWarnings ? JSON.parse(item.parseWarnings) as string[] : []
        const confidence = item.parseConfidence ?? 0
        const confLabel =
          confidence >= 0.8 ? 'green' : confidence >= 0.5 ? 'yellow' : 'red'

        return (
          <div
            key={item.id}
            className="border border-gray-200 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {item.transactionType && (
                  <Badge
                    variant={
                      item.transactionType === 'BUY'
                        ? 'blue'
                        : item.transactionType === 'SELL'
                        ? 'red'
                        : 'green'
                    }
                  >
                    {item.transactionType}
                  </Badge>
                )}
                {item.ticker && (
                  <span className="font-semibold text-gray-900">{item.ticker}</span>
                )}
                {item.quantity && item.price && item.transactionType !== 'DIVIDEND' && (
                  <span className="text-sm text-gray-600">
                    {item.quantity} @ ${item.price}
                  </span>
                )}
                {item.transactionType === 'DIVIDEND' && item.price && (
                  <span className="text-sm text-gray-600">
                    ${item.price}
                  </span>
                )}
                {item.tradeDate && (
                  <span className="text-xs text-gray-500">
                    {formatDate(item.tradeDate)}
                  </span>
                )}
              </div>
              <Badge variant={confLabel as 'green' | 'yellow' | 'red'}>
                {Math.round(confidence * 100)}%
              </Badge>
            </div>

            {warnings.length > 0 && (
              <div className="text-xs text-yellow-700 space-y-0.5">
                {warnings.map((w: string, i: number) => (
                  <p key={i}>⚠ {w}</p>
                ))}
              </div>
            )}

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Select
                  label="Assign to portfolio"
                  value={portfolioMap[item.id] ?? portfolios[0]?.id ?? ''}
                  onChange={(e) =>
                    setPortfolioMap((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  options={portfolios.map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
              <Button
                size="sm"
                onClick={() => confirm(item.id)}
                loading={confirming === item.id}
              >
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
