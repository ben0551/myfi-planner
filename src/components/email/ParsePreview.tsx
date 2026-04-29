'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/formatters'
import type { ParsedTransaction } from '@/lib/email/types'

interface Portfolio {
  id: string
  name: string
}

interface ParsePreviewProps {
  parsed: ParsedTransaction
  rawText: string
  portfolios: Portfolio[]
  onSave: (overrides: Partial<ParsedTransaction> & { portfolioId: string; rawContent: string }) => void
  onDiscard: () => void
}

const typeOptions = [
  { value: 'BUY', label: 'Buy' },
  { value: 'SELL', label: 'Sell' },
  { value: 'DIVIDEND', label: 'Dividend' },
]

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  const label =
    pct >= 80 ? 'green' : pct >= 50 ? ('yellow' as const) : ('red' as const)
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <Badge variant={label}>{pct}% confidence</Badge>
    </div>
  )
}

export function ParsePreview({
  parsed,
  rawText,
  portfolios,
  onSave,
  onDiscard,
}: ParsePreviewProps) {
  const [type, setType] = useState(parsed.transactionType ?? '')
  const [ticker, setTicker] = useState(parsed.ticker ?? '')
  const [quantity, setQuantity] = useState(parsed.quantity?.toString() ?? '')
  const [price, setPrice] = useState(parsed.price?.toString() ?? '')
  const [fees, setFees] = useState(parsed.fees?.toString() ?? '0')
  const [tradeDate, setTradeDate] = useState(
    parsed.tradeDate
      ? new Date(parsed.tradeDate).toISOString().split('T')[0]
      : ''
  )
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    await onSave({
      transactionType: type as 'BUY' | 'SELL' | 'DIVIDEND',
      ticker: ticker.toUpperCase(),
      quantity: quantity ? parseFloat(quantity) : null,
      price: price ? parseFloat(price) : null,
      fees: fees ? parseFloat(fees) : 0,
      tradeDate: tradeDate ? new Date(tradeDate) : null,
      parseConfidence: parsed.parseConfidence,
      parseWarnings: parsed.parseWarnings,
      currency: 'AUD',
      portfolioId,
      rawContent: rawText,
    })
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      <ConfidenceBar confidence={parsed.parseConfidence} />

      {parsed.parseWarnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-1">
          {parsed.parseWarnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-800">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Transaction Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={typeOptions}
          placeholder="Select type"
        />
        <Input
          label="Ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
        />
        {type !== 'DIVIDEND' ? (
          <>
            <Input
              label="Quantity"
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <Input
              label="Price per share ($)"
              type="number"
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </>
        ) : (
          <Input
            label="Dividend Amount ($)"
            type="number"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        )}
        <Input
          label="Fees ($)"
          type="number"
          step="any"
          value={fees}
          onChange={(e) => setFees(e.target.value)}
        />
        <Input
          label="Trade Date"
          type="date"
          value={tradeDate}
          onChange={(e) => setTradeDate(e.target.value)}
        />
        <Select
          label="Portfolio"
          value={portfolioId}
          onChange={(e) => setPortfolioId(e.target.value)}
          options={portfolios.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} loading={loading}>
          Save as Pending
        </Button>
        <Button variant="secondary" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </div>
  )
}
