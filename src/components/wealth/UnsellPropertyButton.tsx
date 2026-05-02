'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export function UnsellPropertyButton({ propertyId }: { propertyId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleUnsell() {
    if (!confirm('Undo this sale? The sold date, sale price, and cost base will be cleared.')) return
    setLoading(true)
    const res = await fetch(`/api/wealth/properties/${propertyId}/unsell`, { method: 'POST' })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Failed to undo sale')
      setLoading(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleUnsell} disabled={loading}>
      {loading ? 'Undoing…' : 'Undo Sale'}
    </Button>
  )
}
