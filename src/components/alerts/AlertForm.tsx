'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface Portfolio {
  id: string
  name: string
}

interface AlertFormProps {
  portfolios: Portfolio[]
  onCreated: () => void
}

const directionOptions = [
  { value: 'ABOVE', label: 'Goes above (↑)' },
  { value: 'BELOW', label: 'Goes below (↓)' },
]

export function AlertForm({ portfolios, onCreated }: AlertFormProps) {
  const [ticker, setTicker] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [direction, setDirection] = useState('ABOVE')
  const [note, setNote] = useState('')
  const [portfolioId, setPortfolioId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!ticker.trim() || !targetPrice) {
      setError('Ticker and target price are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: ticker.toUpperCase(),
          targetPrice: parseFloat(targetPrice),
          direction,
          note: note || undefined,
          portfolioId: portfolioId || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create alert')
        return
      }
      setTicker('')
      setTargetPrice('')
      setNote('')
      onCreated()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="e.g. CBA"
        />
        <Input
          label="Target Price ($)"
          type="number"
          step="any"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          placeholder="e.g. 100.00"
        />
      </div>
      <Select
        label="Alert when price…"
        value={direction}
        onChange={(e) => setDirection(e.target.value)}
        options={directionOptions}
      />
      {portfolios.length > 0 && (
        <Select
          label="Portfolio (optional)"
          value={portfolioId}
          onChange={(e) => setPortfolioId(e.target.value)}
          options={[{ value: '', label: 'Any / none' }, ...portfolios.map((p) => ({ value: p.id, label: p.name }))]}
        />
      )}
      <Input
        label="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Buy target"
      />
      <Button type="submit" loading={loading}>
        Create Alert
      </Button>
    </form>
  )
}
