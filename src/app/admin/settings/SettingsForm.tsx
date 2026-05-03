'use client'

import { useState } from 'react'

export function SettingsForm({ requireApproval: initial, hasFmpApiKey: initialHasKey }: { requireApproval: boolean; hasFmpApiKey: boolean }) {
  const [requireApproval, setRequireApproval] = useState(initial)
  const [fmpApiKey, setFmpApiKey] = useState('')
  const [keyStored, setKeyStored] = useState(initialHasKey)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  async function patch(body: Record<string, unknown>) {
    setSaving(true)
    setSaved(false)
    setError(null)
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to save'); return false }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    return true
  }

  async function handleToggle(value: boolean) {
    if (await patch({ requireApproval: value })) setRequireApproval(value)
  }

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault()
    if (!fmpApiKey) return // empty input keeps existing value
    if (await patch({ fmpApiKey })) {
      setKeyStored(true)
      setFmpApiKey('') // clear input so it can't be read off the page
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Approval toggle */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Require approval for new accounts</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              When enabled, newly registered users will have a PENDING status and must be
              approved by an admin before they can sign in.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={requireApproval}
            disabled={saving}
            onClick={() => handleToggle(!requireApproval)}
            className={`relative ml-6 flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
              requireApproval ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                requireApproval ? 'translate-x-5' : 'translate-x-0.5'
              } mt-0.5`}
            />
          </button>
        </div>
      </div>

      {/* FMP API key */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">
          Financial Modeling Prep API Key
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          Used to fetch company fundamentals, financial ratios, and news on the Research page.
          Free plan includes 250 calls/day.{' '}
          <a
            href="https://site.financialmodelingprep.com/developer/docs/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            Get a key ↗
          </a>
        </p>
        <form onSubmit={handleSaveKey} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={fmpApiKey}
              onChange={(e) => setFmpApiKey(e.target.value)}
              placeholder={keyStored ? 'Key stored — type to replace' : 'Enter API key…'}
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm pr-16 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Save
          </button>
        </form>
        {keyStored && !fmpApiKey && (
          <p className="mt-2 text-xs text-gray-400">
            Key is stored (encrypted). Leave blank to keep, or type a new key to replace.
          </p>
        )}
      </div>

      <div className="h-5">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Saved.</p>}
      </div>
    </div>
  )
}
