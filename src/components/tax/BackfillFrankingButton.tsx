'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function BackfillFrankingButton() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [result, setResult] = useState<{ updated: number; total: number } | null>(null)

  async function run() {
    setState('loading')
    const res = await fetch('/api/tax/backfill-franking', { method: 'POST' })
    const data = await res.json()
    setResult(data)
    setState('done')
    router.refresh()
  }

  if (state === 'done' && result) {
    return (
      <span className="text-xs text-emerald-600">
        Updated {result.updated} of {result.total} dividends with franking %
      </span>
    )
  }

  return (
    <button
      onClick={run}
      disabled={state === 'loading'}
      className="text-xs text-amber-700 underline hover:text-amber-900 disabled:opacity-50"
    >
      {state === 'loading' ? 'Fetching franking data…' : 'Backfill franking % from MarketIndex'}
    </button>
  )
}
