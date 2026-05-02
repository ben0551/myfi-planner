'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface Props {
  portfolioId: string
}

export function SyncDividendsButton({ portfolioId }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  async function handleSync() {
    setState('loading')
    setResult(null)
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/sync-dividends`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      setResult(data)
      setState('done')
    } catch (err) {
      setResult({ created: 0, skipped: 0, errors: [err instanceof Error ? err.message : 'Unknown error'] })
      setState('error')
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        size="sm"
        variant="secondary"
        onClick={handleSync}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? 'Syncing…' : 'Sync Dividends'}
      </Button>
      {state === 'done' && result && (
        <span className="text-sm text-gray-600">
          {result.created > 0
            ? `${result.created} new dividend${result.created !== 1 ? 's' : ''} queued for review`
            : 'All dividends already up to date'}
          {result.skipped > 0 && ` · ${result.skipped} skipped`}
          {result.errors.length > 0 && (
            <span className="text-amber-600 ml-1">· {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}</span>
          )}
        </span>
      )}
      {state === 'error' && result && (
        <span className="text-sm text-red-600">{result.errors[0]}</span>
      )}
    </div>
  )
}
