'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { ParsedTransaction } from '@/lib/email/types'

interface PasteImportProps {
  onParsed: (result: ParsedTransaction, rawText: string) => void
}

export function PasteImport({ onParsed }: PasteImportProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleParse() {
    if (!text.trim()) { setError('Paste some email text first'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/email/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text }),
      })
      const data = await res.json()
      onParsed(data, text)
    } catch {
      setError('Failed to parse email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full h-48 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        placeholder="Paste the plain text of a broker email here (Stake, etc.)…"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={handleParse} loading={loading} disabled={!text.trim()}>
        Parse Email
      </Button>
    </div>
  )
}
