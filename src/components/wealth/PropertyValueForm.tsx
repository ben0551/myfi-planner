'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface Props {
  propertyId: string
  currentValue: number
  currency: string
}

export function PropertyValueForm({ propertyId, currentValue, currency }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(currentValue.toString())
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch(`/api/wealth/properties/${propertyId}/value`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: parseFloat(value),
          date,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to record valuation')
      }

      setSaved(true)
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
      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          Valuation recorded and property value updated.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={`Market Value (${currency})`}
          type="number"
          min="0"
          step="1000"
          required
          placeholder="0"
          hint="Estimated market value at this date"
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false) }}
        />
        <Input
          label="Valuation Date"
          type="date"
          required
          hint="Date of the appraisal or estimate"
          value={date}
          onChange={(e) => { setDate(e.target.value); setSaved(false) }}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Record Valuation
        </Button>
      </div>
    </form>
  )
}
