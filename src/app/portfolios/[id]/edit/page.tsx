'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import useSWR from 'swr'
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

function addMonths(dateStr: string, months: number): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function monthsBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)))
}

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
  const [tdMaturityDate, setTdMaturityDate] = useState('')
  const [tdInterestFreq, setTdInterestFreq] = useState('AT_MATURITY')
  const [tdClosedAt, setTdClosedAt]         = useState<string | null>(null)
  const [tdClosedValue, setTdClosedValue]   = useState<number | null>(null)

  // Close flow
  const [closeDate, setCloseDate]           = useState(() => new Date().toISOString().slice(0, 10))
  const [closeCashId, setCloseCashId]       = useState('')
  const [closing, setClosing]               = useState(false)
  const [closeError, setCloseError]         = useState('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isTd = portfolioType === 'TERM_DEPOSIT'
  const isClosed = Boolean(tdClosedAt)

  const { data: cashAccounts = [] } = useSWR<{ id: string; name: string; balance: number; currency: string }[]>(
    isTd && !isClosed ? '/api/wealth/cash' : null,
    (url: string) => fetch(url).then((r) => r.json())
  )

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
          setTdMaturityDate(p.tdMaturityDate ? p.tdMaturityDate.slice(0, 10) : '')
          setTdInterestFreq(p.tdInterestFreq ?? 'AT_MATURITY')
          setTdClosedAt(p.tdClosedAt ? p.tdClosedAt.slice(0, 10) : null)
          setTdClosedValue(p.tdClosedValue ?? null)
        }
        setLoading(false)
      })
  }, [id])

  // Sync end date when term changes (keep end as source of truth when editing end directly)
  function handleTermChange(val: string) {
    setTdTermMonths(val)
    const months = parseInt(val, 10)
    if (tdStartDate && !isNaN(months) && months > 0) {
      setTdMaturityDate(addMonths(tdStartDate, months))
    }
  }

  function handleMaturityChange(val: string) {
    setTdMaturityDate(val)
    if (tdStartDate && val) {
      setTdTermMonths(String(monthsBetween(tdStartDate, val)))
    }
  }

  function handleStartChange(val: string) {
    setTdStartDate(val)
    if (val && tdMaturityDate) {
      setTdTermMonths(String(monthsBetween(val, tdMaturityDate)))
    } else if (val && tdTermMonths) {
      const months = parseInt(tdTermMonths, 10)
      if (!isNaN(months)) setTdMaturityDate(addMonths(val, months))
    }
  }

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
          ...(isTd ? {
            tdPrincipal, tdRate, tdTermMonths,
            tdStartDate,
            tdMaturityDate: tdMaturityDate || undefined,
            tdInterestFreq,
          } : {}),
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

  async function handleClose() {
    setClosing(true)
    setCloseError('')
    try {
      const res = await fetch(`/api/portfolios/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closeDate, cashAccountId: closeCashId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCloseError(data.error ?? 'Failed to close')
        return
      }
      router.push(`/portfolios/${id}`)
    } catch {
      setCloseError('Network error')
    } finally {
      setClosing(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this portfolio? This cannot be undone.')) return
    await fetch(`/api/portfolios/${id}`, { method: 'DELETE' })
    router.push('/')
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Portfolio</h1>

      {isClosed && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          This term deposit was closed on {tdClosedAt} with a final value of {tdClosedValue != null ? new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(tdClosedValue) : '—'}.
        </div>
      )}

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
                disabled={isClosed}
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
                  disabled={loading || isClosed}
                />
                <Input
                  label="Term (months)"
                  type="number"
                  min="1"
                  max="120"
                  placeholder="12"
                  value={tdTermMonths}
                  onChange={(e) => handleTermChange(e.target.value)}
                  disabled={loading || isClosed}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  required
                  value={tdStartDate}
                  onChange={(e) => handleStartChange(e.target.value)}
                  disabled={loading || isClosed}
                />
                <Input
                  label="End Date (Maturity)"
                  type="date"
                  value={tdMaturityDate}
                  onChange={(e) => handleMaturityChange(e.target.value)}
                  disabled={loading || isClosed}
                />
              </div>
              <Select
                label="Interest Payment"
                value={tdInterestFreq}
                onChange={(e) => setTdInterestFreq(e.target.value)}
                options={interestFreqOptions}
                disabled={loading || isClosed}
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} disabled={isClosed}>Save Changes</Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </Card>

      {/* ── Close Term Deposit ──────────────────────────────────────────────── */}
      {isTd && !isClosed && (
        <div className="mt-6 p-5 border border-amber-200 rounded-xl bg-amber-50 space-y-4">
          <div>
            <h3 className="font-semibold text-amber-900">Close Term Deposit</h3>
            <p className="text-sm text-amber-700 mt-0.5">
              Record an early or on-time close and optionally transfer proceeds to a savings account.
            </p>
          </div>

          {closeError && (
            <p className="text-sm text-red-600">{closeError}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Close Date"
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Transfer to savings account <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <select
                value={closeCashId}
                onChange={(e) => setCloseCashId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— No transfer —</option>
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button variant="secondary" onClick={handleClose} loading={closing}>
            Close Term Deposit
          </Button>
        </div>
      )}

      {/* ── Danger Zone ─────────────────────────────────────────────────────── */}
      <div className="mt-6 p-4 border border-red-200 rounded-lg bg-red-50">
        <h3 className="font-medium text-red-800 mb-2">Danger Zone</h3>
        <p className="text-sm text-red-600 mb-3">
          Deleting this portfolio cannot be undone.
        </p>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          Delete Portfolio
        </Button>
      </div>
    </div>
  )
}
