'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { LabelledCurrencyInput } from '@/components/ui/CurrencyInput'

const currencyOptions = [
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
]

const portfolioTypeOptions = [
  { value: 'SHARES', label: 'Share Portfolio' },
  { value: 'TERM_DEPOSIT', label: 'Term Deposit' },
]

const interestFreqOptions = [
  { value: 'AT_MATURITY', label: 'At Maturity' },
  { value: 'MONTHLY',     label: 'Monthly' },
  { value: 'QUARTERLY',   label: 'Quarterly' },
]

export default function NewPortfolioPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('AUD')
  const [portfolioType, setPortfolioType] = useState('SHARES')

  // TD fields
  const [tdPrincipal, setTdPrincipal]   = useState('')
  const [tdRate, setTdRate]             = useState('')
  const [tdTermMonths, setTdTermMonths] = useState('')
  const [tdStartDate, setTdStartDate]   = useState('')
  const [tdInterestFreq, setTdInterestFreq] = useState('AT_MATURITY')

  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const isTd = portfolioType === 'TERM_DEPOSIT'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (isTd) {
      if (!tdPrincipal || !tdRate || !tdTermMonths || !tdStartDate) {
        setError('All term deposit fields are required')
        return
      }
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description, currency, portfolioType,
          ...(isTd ? { tdPrincipal, tdRate, tdTermMonths, tdStartDate, tdInterestFreq } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create portfolio')
        return
      }
      const portfolio = await res.json()
      router.push(`/portfolios/${portfolio.id}`)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Portfolio</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            {portfolioTypeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPortfolioType(opt.value)}
                className={`rounded-xl border-2 px-4 py-3 text-sm font-medium text-left transition-colors ${
                  portfolioType === opt.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">{opt.label}</div>
                <div className="text-xs mt-0.5 font-normal opacity-70">
                  {opt.value === 'SHARES' ? 'ASX, US stocks, ETFs' : 'Fixed-rate term investment'}
                </div>
              </button>
            ))}
          </div>

          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isTd ? 'e.g. ANZ Term Deposit' : 'e.g. Long-term investments'}
          />
          <Input
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
          />
          <Select
            label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={currencyOptions}
          />

          {/* Term Deposit fields */}
          {isTd && (
            <div className="space-y-4 rounded-xl bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Term Deposit Details</p>
              <LabelledCurrencyInput
                label="Principal"
                required
                placeholder="50,000"
                value={tdPrincipal}
                onChange={setTdPrincipal}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Interest Rate (% p.a.)"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="4.75"
                  value={tdRate}
                  onChange={(e) => setTdRate(e.target.value)}
                />
                <Input
                  label="Term (months)"
                  type="number"
                  min="1"
                  max="120"
                  required
                  placeholder="12"
                  value={tdTermMonths}
                  onChange={(e) => setTdTermMonths(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  required
                  value={tdStartDate}
                  onChange={(e) => setTdStartDate(e.target.value)}
                />
                <Select
                  label="Interest Payment"
                  value={tdInterestFreq}
                  onChange={(e) => setTdInterestFreq(e.target.value)}
                  options={interestFreqOptions}
                />
              </div>
              {tdPrincipal && tdRate && tdTermMonths && (
                <p className="text-xs text-blue-600">
                  Total interest at maturity:{' '}
                  <strong>
                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(
                      parseFloat(tdPrincipal.replace(/,/g, '') || '0') *
                      (parseFloat(tdRate) / 100) *
                      (parseInt(tdTermMonths) / 12)
                    )}
                  </strong>
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading}>
              {isTd ? 'Create Term Deposit' : 'Create Portfolio'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
