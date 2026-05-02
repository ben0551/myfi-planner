'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

const interestFreqOptions = [
  { value: 'AT_MATURITY', label: 'At Maturity' },
  { value: 'MONTHLY',     label: 'Monthly' },
  { value: 'QUARTERLY',   label: 'Quarterly' },
]

export default function EditPortfolioPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('AUD')
  const [portfolioType, setPortfolioType] = useState('SHARES')

  // TD fields
  const [tdPrincipal, setTdPrincipal]       = useState('')
  const [tdRate, setTdRate]                 = useState('')
  const [tdTermMonths, setTdTermMonths]     = useState('')
  const [tdStartDate, setTdStartDate]       = useState('')
  const [tdInterestFreq, setTdInterestFreq] = useState('AT_MATURITY')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isTd = portfolioType === 'TERM_DEPOSIT'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/portfolios/${id}`)
      .then((r) => r.json())
      .then((p) => {
        setName(p.name ?? '')
        setDescription(p.description ?? '')
        setCurrency(p.currency ?? 'AUD')
        setPortfolioType(p.portfolioType ?? 'SHARES')
        if (p.portfolioType === 'TERM_DEPOSIT') {
          setTdPrincipal(p.tdPrincipal != null ? String(p.tdPrincipal) : '')
          setTdRate(p.tdRate != null ? String(p.tdRate) : '')
          setTdTermMonths(p.tdTermMonths != null ? String(p.tdTermMonths) : '')
          setTdStartDate(p.tdStartDate ? p.tdStartDate.slice(0, 10) : '')
          setTdInterestFreq(p.tdInterestFreq ?? 'AT_MATURITY')
        }
        setLoading(false)
      })
  }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/portfolios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description, currency,
          ...(isTd ? { tdPrincipal, tdRate, tdTermMonths, tdStartDate, tdInterestFreq } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save')
        return
      }
      router.push(`/portfolios/${id}`)
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this portfolio and all its transactions? This cannot be undone.')) return
    await fetch(`/api/portfolios/${id}`, { method: 'DELETE' })
    router.push('/')
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Portfolio</h1>
      <Card>
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <Input
            label="Portfolio Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
          <Input
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
          <Select
            label="Base Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={currencyOptions}
            disabled={loading}
          />

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
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  required
                  value={tdStartDate}
                  onChange={(e) => setTdStartDate(e.target.value)}
                  disabled={loading}
                />
                <Select
                  label="Interest Payment"
                  value={tdInterestFreq}
                  onChange={(e) => setTdInterestFreq(e.target.value)}
                  options={interestFreqOptions}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving}>Save Changes</Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </Card>

      <div className="mt-6 p-4 border border-red-200 rounded-lg bg-red-50">
        <h3 className="font-medium text-red-800 mb-2">Danger Zone</h3>
        <p className="text-sm text-red-600 mb-3">
          Deleting this portfolio will also delete all its transactions.
        </p>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          Delete Portfolio
        </Button>
      </div>
    </div>
  )
}
