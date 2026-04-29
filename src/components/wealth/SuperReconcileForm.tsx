'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface Props {
  accountId: string
  currentBalance: number
  currency: string
  /** Override the API path — defaults to /api/wealth/super/[accountId]/balance */
  apiPath?: string
}

export function SuperReconcileForm({ accountId, currentBalance, currency, apiPath }: Props) {
  const router = useRouter()
  const [balance, setBalance] = useState(currentBalance.toString())
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
      const res = await fetch(apiPath ?? `/api/wealth/super/${accountId}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          balance: parseFloat(balance),
          date,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to record balance')
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
          Balance recorded and account updated.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={`Balance (${currency})`}
          type="number"
          min="0"
          step="1"
          required
          placeholder="0"
          hint="Enter the balance as shown on your statement"
          value={balance}
          onChange={(e) => { setBalance(e.target.value); setSaved(false) }}
        />
        <Input
          label="Statement Date"
          type="date"
          required
          hint="Date the balance was recorded"
          value={date}
          onChange={(e) => { setDate(e.target.value); setSaved(false) }}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Record Balance
        </Button>
      </div>
    </form>
  )
}
