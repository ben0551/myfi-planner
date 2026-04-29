'use client'

import { useState } from 'react'

export function SettingsForm({ requireApproval: initial }: { requireApproval: boolean }) {
  const [requireApproval, setRequireApproval] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle(value: boolean) {
    setSaving(true)
    setSaved(false)
    setError(null)
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireApproval: value }),
    })
    setSaving(false)
    if (!res.ok) {
      setError('Failed to save settings')
      return
    }
    setRequireApproval(value)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Require approval for new accounts</h2>
          <p className="mt-1 text-sm text-gray-500">
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

      <div className="mt-4 h-5">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Settings saved.</p>}
        {saving && <p className="text-sm text-gray-400">Saving…</p>}
      </div>
    </div>
  )
}
