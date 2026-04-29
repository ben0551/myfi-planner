'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export function DeleteInheritanceButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/wealth/inheritance/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Remove {name}?</span>
        <Button size="sm" variant="danger" loading={loading} onClick={handleDelete}>Yes</Button>
        <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>No</Button>
      </div>
    )
  }

  return (
    <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
      Remove
    </Button>
  )
}
