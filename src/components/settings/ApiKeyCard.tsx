'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function ApiKeyCard({ initialApiKey }: { initialApiKey: string | null }) {
  const [apiKey, setApiKey] = useState(initialApiKey)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    if (apiKey && !confirm('This will invalidate your existing API key. Any integrations using it will stop working. Continue?')) return
    setLoading(true)
    const res = await fetch('/api/user/api-key', { method: 'POST' })
    const data = await res.json()
    setApiKey(data.apiKey)
    setRevealed(true)
    setLoading(false)
  }

  async function revoke() {
    if (!confirm('Revoke your API key? Any integrations using it will stop working immediately.')) return
    setLoading(true)
    await fetch('/api/user/api-key', { method: 'DELETE' })
    setApiKey(null)
    setRevealed(false)
    setLoading(false)
  }

  async function copy() {
    if (!apiKey) return
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const masked = apiKey ? apiKey.slice(0, 8) + '••••••••••••••••••••••••••••••••••••••' : null

  return (
    <Card>
      <h2 className="font-semibold text-gray-900 dark:text-white mb-1">API Key</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
        Use this key in the <code className="text-xs bg-gray-100 dark:bg-slate-700 px-1 rounded">Authorization: Bearer</code> header to call the API from external tools or scripts.
      </p>

      {apiKey ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-slate-100 overflow-hidden text-ellipsis whitespace-nowrap">
              {revealed ? apiKey : masked}
            </div>
            <Button size="sm" variant="secondary" onClick={() => setRevealed((r) => !r)}>
              {revealed ? 'Hide' : 'Show'}
            </Button>
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={generate} disabled={loading}>
              Regenerate
            </Button>
            <Button size="sm" variant="ghost" onClick={revoke} disabled={loading}>
              Revoke
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={generate} disabled={loading} loading={loading}>
          Generate API key
        </Button>
      )}
    </Card>
  )
}
