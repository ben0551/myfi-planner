'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface CashValues {
  name: string
  institution: string
  balance: string
  currency: string
  notes: string
}

interface Props {
  accountId?: string
  initialValues?: Partial<CashValues>
}

const CURRENCIES = [
  { value: 'AUD', label: 'AUD' },
  { value: 'USD', label: 'USD' },
  { value: 'NZD', label: 'NZD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'EUR', label: 'EUR' },
]

const defaults: CashValues = {
  name: '',
  institution: '',
  balance: '',
  currency: 'AUD',
  notes: '',
}

export function CashAccountForm({ accountId, initialValues }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<CashValues>({ ...defaults, ...initialValues })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = Boolean(accountId)

  function set(field: keyof CashValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      name: values.name,
      institution: values.institution || null,
      balance: parseFloat(values.balance),
      currency: values.currency,
      notes: values.notes || null,
    }

    try {
      const res = await fetch(
        isEdit ? `/api/wealth/cash/${accountId}` : '/api/wealth/cash',
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
          label="Account Name"
          required
          placeholder="e.g. Emergency Fund"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <Input
          label="Institution (optional)"
          placeholder="e.g. ING, Macquarie"
          value={values.institution}
          onChange={(e) => set('institution', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Balance"
          type="number"
          min="0"
          step="0.01"
          required
          placeholder="25000"
          value={values.balance}
          onChange={(e) => set('balance', e.target.value)}
        />
        <Select
          label="Currency"
          options={CURRENCIES}
          value={values.currency}
          onChange={(e) => set('currency', e.target.value)}
        />
      </div>

      <Input
        label="Notes (optional)"
        placeholder="e.g. High-interest savings, 3-month emergency fund"
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
