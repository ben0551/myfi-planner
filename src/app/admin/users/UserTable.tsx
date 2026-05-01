'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type User = {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  createdAt: Date | string
  lastLoginAt: Date | string | null
  apiKey: string | null
  tickers: number
  totalAssets: number | null
  totalLiabilities: number | null
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE:   'bg-green-50 text-green-700 border-green-200',
    PENDING:  'bg-yellow-50 text-yellow-700 border-yellow-200',
    DISABLED: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
      {status}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
      role === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-600 border-gray-200'
    }`}>
      {role}
    </span>
  )
}

function fmt(v: number | null): string {
  if (v == null) return '—'
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function fmtDate(d: Date | string | null): string {
  if (!d) return 'Never'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function maskKey(key: string): string {
  // Show prefix + first 6 chars of hex, then ellipsis
  const parts = key.split('_')
  if (parts.length === 2) return `${parts[0]}_${parts[1].slice(0, 6)}…`
  return `${key.slice(0, 10)}…`
}

export function UserTable({ users: initialUsers, currentUserId }: { users: User[]; currentUserId: string }) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Password reset modal
  const [resetModal, setResetModal] = useState<{ id: string; email: string } | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetDone, setResetDone] = useState(false)
  const [resetLinkInfo, setResetLinkInfo] = useState<string | null>(null)

  // Newly generated API key (shown once)
  const [newApiKey, setNewApiKey] = useState<{ userId: string; key: string } | null>(null)

  async function patch(id: string, body: Record<string, unknown>) {
    setLoading(id)
    setError(null)
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(null)
    if (!res.ok) { setError(data.error ?? 'Update failed'); return data }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)))
    return data
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user and all their data? This cannot be undone.')) return
    setLoading(id)
    setError(null)
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    setLoading(null)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Delete failed'); return }
    setUsers((prev) => prev.filter((u) => u.id !== id))
    router.refresh()
  }

  async function handleResetPassword() {
    if (!resetModal) return
    if (!resetPw || resetPw.length < 8) { setResetError('Password must be at least 8 characters'); return }
    setResetLoading(true)
    setResetError(null)
    const res = await fetch(`/api/admin/users/${resetModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resetPassword', password: resetPw }),
    })
    const data = await res.json()
    setResetLoading(false)
    if (!res.ok) { setResetError(data.error ?? 'Failed'); return }
    setResetDone(true)
  }

  async function handleSendResetLink(userId: string, email: string) {
    setLoading(userId)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sendResetLink' }),
    })
    const data = await res.json()
    setLoading(null)
    if (!res.ok) { setError(data.error ?? 'Failed'); return }
    if (data.resetUrl) {
      // SMTP not configured — show URL for manual delivery
      setResetLinkInfo(data.resetUrl)
    } else {
      alert(`Reset link sent to ${email}`)
    }
  }

  async function handleGenerateApiKey(userId: string) {
    const data = await patch(userId, { action: 'generateApiKey' })
    if (data?.apiKey) {
      setNewApiKey({ userId, key: data.apiKey })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, apiKey: data.apiKey } : u)))
    }
  }

  async function handleRevokeApiKey(userId: string) {
    if (!confirm('Revoke this API key? Any integrations using it will stop working.')) return
    await patch(userId, { action: 'revokeApiKey' })
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, apiKey: null } : u)))
    if (newApiKey?.userId === userId) setNewApiKey(null)
  }

  function closeResetModal() {
    setResetModal(null)
    setResetPw('')
    setResetError(null)
    setResetDone(false)
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Reset link info banner */}
      {resetLinkInfo && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm">
          <p className="font-medium text-amber-800 mb-1">SMTP not configured — share this link manually:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-amber-200 rounded px-2 py-1 break-all">{resetLinkInfo}</code>
            <button onClick={() => { navigator.clipboard.writeText(resetLinkInfo); setResetLinkInfo(null) }}
              className="text-xs px-2.5 py-1 rounded bg-amber-600 text-white hover:bg-amber-700">Copy & close</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status / Role</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tickers</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Assets</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Liabilities</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {users.map((user) => {
              const isSelf = user.id === currentUserId
              const busy = loading === user.id
              const isNewKey = newApiKey?.userId === user.id
              return (
                <tr key={user.id} className={isSelf ? 'bg-indigo-50/30' : 'hover:bg-gray-50/50'}>
                  {/* User */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{user.name ?? '—'}</div>
                    <div className="text-gray-500 text-xs">{user.email}</div>
                    {isSelf && <div className="text-xs text-indigo-500 mt-0.5">You</div>}
                    <div className="text-xs text-gray-400 mt-0.5">Joined {fmtDate(user.createdAt)}</div>
                  </td>

                  {/* Status + Role */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={user.status} />
                      <RoleBadge role={user.role} />
                    </div>
                  </td>

                  {/* Tickers */}
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                    {user.tickers > 0 ? user.tickers : <span className="text-gray-300">—</span>}
                  </td>

                  {/* Assets */}
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                    {user.totalAssets != null ? fmt(user.totalAssets) : <span className="text-gray-300">—</span>}
                  </td>

                  {/* Liabilities */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {user.totalLiabilities != null && user.totalLiabilities > 0
                      ? <span className="text-red-600">{fmt(user.totalLiabilities)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>

                  {/* Last Login */}
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {fmtDate(user.lastLoginAt)}
                  </td>

                  {/* API Key */}
                  <td className="px-4 py-3">
                    {user.apiKey ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">
                            {isNewKey ? user.apiKey : maskKey(user.apiKey)}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(user.apiKey!)}
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            Copy
                          </button>
                        </div>
                        {isNewKey && (
                          <p className="text-xs text-amber-600">Save this key — it won&apos;t be shown again.</p>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => handleRevokeApiKey(user.id)}
                          className="text-xs text-red-500 hover:underline disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => handleGenerateApiKey(user.id)}
                        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                      >
                        Generate key
                      </button>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {user.status === 'PENDING' && (
                        <button disabled={busy} onClick={() => patch(user.id, { status: 'ACTIVE' })}
                          className="text-xs px-2.5 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                          Approve
                        </button>
                      )}
                      {user.status === 'ACTIVE' && !isSelf && (
                        <button disabled={busy} onClick={() => patch(user.id, { status: 'DISABLED' })}
                          className="text-xs px-2.5 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
                          Disable
                        </button>
                      )}
                      {user.status === 'DISABLED' && (
                        <button disabled={busy} onClick={() => patch(user.id, { status: 'ACTIVE' })}
                          className="text-xs px-2.5 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                          Enable
                        </button>
                      )}
                      {user.role === 'USER' && (
                        <button disabled={busy} onClick={() => patch(user.id, { role: 'ADMIN' })}
                          className="text-xs px-2.5 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                          Make Admin
                        </button>
                      )}
                      {user.role === 'ADMIN' && !isSelf && (
                        <button disabled={busy} onClick={() => patch(user.id, { role: 'USER' })}
                          className="text-xs px-2.5 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50">
                          Remove Admin
                        </button>
                      )}
                      <button disabled={busy}
                        onClick={() => { setResetModal({ id: user.id, email: user.email }); setResetDone(false) }}
                        className="text-xs px-2.5 py-1 rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">
                        Reset PW
                      </button>
                      <button disabled={busy} onClick={() => handleSendResetLink(user.id, user.email)}
                        className="text-xs px-2.5 py-1 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
                        Send Link
                      </button>
                      {!isSelf && (
                        <button disabled={busy} onClick={() => deleteUser(user.id)}
                          className="text-xs px-2.5 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Password reset modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeResetModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Reset Password</h2>
              <button onClick={closeResetModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-gray-500">Set a new password for <strong>{resetModal.email}</strong></p>

            {resetDone ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                Password updated successfully.
              </div>
            ) : (
              <>
                {resetError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{resetError}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                  <input
                    type="password"
                    minLength={8}
                    value={resetPw}
                    onChange={(e) => setResetPw(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={closeResetModal}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={handleResetPassword} disabled={resetLoading}
                    className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {resetLoading ? 'Saving…' : 'Set Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
