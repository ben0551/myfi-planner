'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function ProfileCard({ initialName, initialEmail }: { initialName: string; initialEmail: string }) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Card>
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
      <form onSubmit={save} className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" size="sm" loading={saving}>
          {saved ? 'Saved!' : 'Save changes'}
        </Button>
      </form>
    </Card>
  )
}
