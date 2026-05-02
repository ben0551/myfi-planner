'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { LabelledCurrencyInput } from '@/components/ui/CurrencyInput'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface SuperValues {
  fundName: string
  accountNumber: string
  currentBalance: string
  employerContribPct: string
  employeeContribPct: string
  currency: string
  notes: string
}

interface Props {
  accountId?: string
  initialValues?: Partial<SuperValues>
}

const CURRENCIES = [
  { value: 'AUD', label: 'AUD' },
  { value: 'USD', label: 'USD' },
  { value: 'NZD', label: 'NZD' },
]

const defaults: SuperValues = {
  fundName: '',
  accountNumber: '',
  currentBalance: '',
  employerContribPct: '11.5',
  employeeContribPct: '0',
  currency: 'AUD',
  notes: '',
}

export function SuperAccountForm({ accountId, initialValues }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<SuperValues>({ ...defaults, ...initialValues })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = Boolean(accountId)

  function set(field: keyof SuperValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      fundName: values.fundName,
      accountNumber: values.accountNumber || null,
      currentBalance: parseFloat(values.currentBalance),
      employerContribPct: parseFloat(values.employerContribPct),
      employeeContribPct: parseFloat(values.employeeContribPct),
      currency: values.currency,
      notes: values.notes || null,
    }

    try {
      const res = await fetch(
        isEdit ? `/api/wealth/super/${accountId}` : '/api/wealth/super',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save account')
      }

      if (!isEdit) {
        setValues(defaults)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Fund Name"
          required
          placeholder="e.g. Australian Super"
          value={values.fundName}
          onChange={(e) => set('fundName', e.target.value)}
        />
        <Input
          label="Account Number (optional)"
          placeholder="e.g. 12345678"
          value={values.accountNumber}
          onChange={(e) => set('accountNumber', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LabelledCurrencyInput
          label="Current Balance"
          required
          placeholder="75,000"
          decimalScale={2}
          value={values.currentBalance}
          onChange={(v) => set('currentBalance', v)}
        />
        <Select
          label="Currency"
          options={CURRENCIES}
          value={values.currency}
          onChange={(e) => set('currency', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Employer Contribution (%)"
          type="number"
          min="0"
          max="100"
          step="0.1"
          hint="Superannuation guarantee rate (currently 11.5%)"
          value={values.employerContribPct}
          onChange={(e) => set('employerContribPct', e.target.value)}
        />
        <Input
          label="Employee Contribution (%)"
          type="number"
          min="0"
          max="100"
          step="0.1"
          hint="Optional salary sacrifice or voluntary contributions"
          value={values.employeeContribPct}
          onChange={(e) => set('employeeContribPct', e.target.value)}
        />
      </div>

      <Input
        label="Notes (optional)"
        placeholder="e.g. Balanced growth option"
        value={values.notes}
        onChange={(e) => set('notes', e.target.value)}
      />

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save Changes' : 'Add Account'}
        </Button>
      </div>
    </form>
  )
}
