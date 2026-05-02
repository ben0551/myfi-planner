'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { LabelledCurrencyInput } from '@/components/ui/CurrencyInput'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface InitialValues {
  type: string
  ticker: string
  date: string
  quantity: string
  price: string
  fees: string
  amount: string
  frankingCredit: string
  notes: string
}

interface TransactionFormProps {
  portfolioId: string
  transactionId?: string       // if set, PUT (edit mode)
  initialValues?: InitialValues
  onSuccess?: () => void
}

const typeOptions = [
  { value: 'BUY',      label: 'Buy' },
  { value: 'SELL',     label: 'Sell' },
  { value: 'DIVIDEND', label: 'Dividend' },
  { value: 'DRP',      label: 'DRP (Dividend Reinvestment)' },
]

export function TransactionForm({
  portfolioId,
  transactionId,
  initialValues,
  onSuccess,
}: TransactionFormProps) {
  const router = useRouter()
  const editing = !!transactionId

  const [type, setType] = useState(initialValues?.type ?? 'BUY')
  const [ticker, setTicker] = useState(initialValues?.ticker ?? '')
  const [date, setDate] = useState(
    initialValues?.date ?? new Date().toISOString().split('T')[0]
  )
  const [quantity, setQuantity] = useState(initialValues?.quantity ?? '')
  const [price, setPrice] = useState(initialValues?.price ?? '')
  const [fees, setFees] = useState(initialValues?.fees ?? '')
  const [amount, setAmount] = useState(initialValues?.amount ?? '')
  const [frankingCredit, setFrankingCredit] = useState(initialValues?.frankingCredit ?? '0')
  const [notes, setNotes] = useState(initialValues?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const isDividendLike = type === 'DIVIDEND'
    const isDrp = type === 'DRP'
    const needsQtyPrice = !isDividendLike  // BUY, SELL, DRP all need qty+price

    if (!ticker.trim()) { setError('Ticker is required'); return }
    if (!date) { setError('Date is required'); return }
    if (needsQtyPrice && !quantity) { setError('Quantity is required'); return }
    if (needsQtyPrice && !price) { setError('Price is required'); return }
    if (isDividendLike && !amount) { setError('Dividend amount is required'); return }

    setLoading(true)
    try {
      const url = editing ? `/api/transactions/${transactionId}` : '/api/transactions'
      const method = editing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          type,
          ticker: ticker.toUpperCase(),
          date,
          quantity: isDividendLike ? 0 : parseFloat(quantity),
          price: isDividendLike ? 0 : parseFloat(price),
          fees: fees ? parseFloat(fees) : 0,
          amount: (isDividendLike || isDrp) ? (amount ? parseFloat(amount) : undefined) : undefined,
          frankingCredit: (isDividendLike || isDrp) ? parseFloat(frankingCredit) || 0 : 0,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save transaction')
        return
      }
      onSuccess?.()
      router.push(`/portfolios/${portfolioId}/transactions`)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Transaction Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={typeOptions}
        />
        <Input
          label="Ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="e.g. CBA"
          hint="ASX code without .AX"
        />
      </div>

      <Input
        label="Date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {type === 'DIVIDEND' ? (
        <div className="space-y-4">
          <LabelledCurrencyInput
            label="Dividend Amount ($)"
            value={amount}
            onChange={(v) => setAmount(v)}
            placeholder="Total cash received"
          />
          <LabelledCurrencyInput
            label="Franking Credits ($)"
            value={frankingCredit}
            onChange={(v) => setFrankingCredit(v)}
            placeholder="0.00"
            hint="From your dividend statement"
          />
        </div>
      ) : type === 'DRP' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Shares received"
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 12.345"
            />
            <LabelledCurrencyInput
              label="DRP price per share ($)"
              decimalScale={4}
              value={price}
              onChange={(v) => setPrice(v)}
              placeholder="e.g. 4.50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <LabelledCurrencyInput
              label="Dividend value ($, optional)"
              value={amount}
              onChange={(v) => setAmount(v)}
              placeholder={quantity && price ? String(parseFloat(quantity || '0') * parseFloat(price.replace(/,/g, '') || '0')) : '0'}
              hint="Defaults to shares × price"
            />
            <LabelledCurrencyInput
              label="Franking Credits ($)"
              value={frankingCredit}
              onChange={(v) => setFrankingCredit(v)}
              placeholder="0.00"
              hint="From your dividend statement"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Quantity (shares)"
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 100"
          />
          <LabelledCurrencyInput
            label="Price per share ($)"
            decimalScale={4}
            value={price}
            onChange={(v) => setPrice(v)}
            placeholder="45.50"
          />
        </div>
      )}

      {type !== 'DIVIDEND' && type !== 'DRP' && (
        <LabelledCurrencyInput
          label="Brokerage / Fees ($)"
          value={fees}
          onChange={(v) => setFees(v)}
          placeholder="0"
        />
      )}

      <Input
        label="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Any notes about this transaction"
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading}>
          {editing ? 'Save Changes' : 'Save Transaction'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
