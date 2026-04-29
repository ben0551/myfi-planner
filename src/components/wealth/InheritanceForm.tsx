'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface InheritanceValues {
  name: string
  amount: string
  expectedYear: string
  probability: string
  notes: string
  includeInFire: boolean
}

interface Props {
  itemId?: string
  initialValues?: Partial<InheritanceValues>
  onCancel?: () => void
}

const currentYear = new Date().getFullYear()

const defaults: InheritanceValues = {
  name: '',
  amount: '',
  expectedYear: String(currentYear + 10),
  probability: '100',
  notes: '',
  includeInFire: true,
}

export function InheritanceForm({ itemId, initialValues, onCancel }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<InheritanceValues>({ ...defaults, ...initialValues })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = Boolean(itemId)

  function set(field: keyof InheritanceValues, value: string | boolean) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  const effectiveAmount = values.amount
    ? (parseFloat(values.amount) * parseInt(values.probability || '100')) / 100
    : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        isEdit ? `/api/wealth/inheritance/${itemId}` : '/api/wealth/inheritance',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            amount: parseFloat(values.amount),
            expectedYear: parseInt(values.expectedYear),
            probability: parseInt(values.probability),
            notes: values.notes || null,
            includeInFire: values.includeInFire,
          }),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save')
      }

      if (!isEdit) setValues(defaults)
      router.refresh()
      onCancel?.()
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

      <Input
        label="Description"
        required
        placeholder="e.g. Parents' estate, Grandma's house"
        value={values.name}
        onChange={(e) => set('name', e.target.value)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Expected Amount (AUD)"
          type="number"
          min="0"
          step="1000"
          required
          placeholder="500000"
          value={values.amount}
          onChange={(e) => set('amount', e.target.value)}
        />
        <Input
          label="Expected Year"
          type="number"
          min={currentYear}
          max={currentYear + 60}
          required
          value={values.expectedYear}
          onChange={(e) => set('expectedYear', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Probability: <span className="text-indigo-600 font-semibold">{values.probability}%</span>
          {effectiveAmount > 0 && values.probability !== '100' && (
            <span className="ml-2 text-gray-400 font-normal">
              → effective{' '}
              {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(effectiveAmount)}
            </span>
          )}
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={values.probability}
          onChange={(e) => set('probability', e.target.value)}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>Uncertain</span>
          <span>Certain</span>
        </div>
      </div>

      <Input
        label="Notes (optional)"
        placeholder="e.g. 50% share with sibling"
        value={values.notes}
        onChange={(e) => set('notes', e.target.value)}
      />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={values.includeInFire}
          onChange={(e) => set('includeInFire', e.target.checked)}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Include in FIRE projections
      </label>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save Changes' : 'Add Inheritance'}
        </Button>
      </div>
    </form>
  )
}
