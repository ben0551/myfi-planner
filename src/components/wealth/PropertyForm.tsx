'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface PropertyValues {
  name: string
  address: string
  type: string
  purchasePrice: string
  purchaseDate: string
  currentValue: string
  ownershipPct: string
  currency: string
  notes: string
}

interface Props {
  propertyId?: string
  initialValues?: Partial<PropertyValues>
  onSuccess?: () => void
}

const PROPERTY_TYPES = [
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'INVESTMENT', label: 'Investment' },
  { value: 'LAND', label: 'Land' },
  { value: 'COMMERCIAL', label: 'Commercial' },
]

const CURRENCIES = [
  { value: 'AUD', label: 'AUD' },
  { value: 'USD', label: 'USD' },
  { value: 'NZD', label: 'NZD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'EUR', label: 'EUR' },
]

const defaultValues: PropertyValues = {
  name: '',
  address: '',
  type: 'RESIDENTIAL',
  purchasePrice: '',
  purchaseDate: '',
  currentValue: '',
  ownershipPct: '100',
  currency: 'AUD',
  notes: '',
}

export function PropertyForm({ propertyId, initialValues, onSuccess }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<PropertyValues>({
    ...defaultValues,
    ...initialValues,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = Boolean(propertyId)

  function set(field: keyof PropertyValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      name: values.name,
      address: values.address || null,
      type: values.type,
      purchasePrice: parseFloat(values.purchasePrice),
      purchaseDate: values.purchaseDate,
      currentValue: parseFloat(values.currentValue),
      ownershipPct: parseFloat(values.ownershipPct),
      currency: values.currency,
      notes: values.notes || null,
    }

    try {
      const res = await fetch(
        isEdit ? `/api/wealth/properties/${propertyId}` : '/api/wealth/properties',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save property')
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
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
          label="Property Name"
          required
          placeholder="e.g. 42 Smith St"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <Select
          label="Type"
          options={PROPERTY_TYPES}
          value={values.type}
          onChange={(e) => set('type', e.target.value)}
        />
      </div>

      <Input
        label="Address (optional)"
        placeholder="Full address"
        value={values.address}
        onChange={(e) => set('address', e.target.value)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Purchase Price"
          type="number"
          min="0"
          step="1"
          required
          placeholder="500000"
          value={values.purchasePrice}
          onChange={(e) => set('purchasePrice', e.target.value)}
        />
        <Input
          label="Purchase Date"
          type="date"
          required
          value={values.purchaseDate}
          onChange={(e) => set('purchaseDate', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Current Value"
          type="number"
          min="0"
          step="1"
          required
          placeholder="600000"
          value={values.currentValue}
          onChange={(e) => set('currentValue', e.target.value)}
        />
        <Input
          label="Ownership %"
          type="number"
          min="0"
          max="100"
          step="0.1"
          required
          value={values.ownershipPct}
          onChange={(e) => set('ownershipPct', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Currency"
          options={CURRENCIES}
          value={values.currency}
          onChange={(e) => set('currency', e.target.value)}
        />
        <Input
          label="Notes (optional)"
          placeholder="Any additional notes"
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save Changes' : 'Add Property'}
        </Button>
      </div>
    </form>
  )
}
