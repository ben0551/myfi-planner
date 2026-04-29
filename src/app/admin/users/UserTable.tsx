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
  _count: { portfolios: number }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-50 text-green-700 border-green-200',
    PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
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
      role === 'ADMIN'
        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'
    }`}>
      {role}
    </span>
  )
}

export function UserTable({ users: initialUsers, currentUserId }: { users: User[]; currentUserId: string }) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function patch(id: string, body: Record<string, string>) {
    setLoading(id)
    setError(null)
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(null)
    if (!res.ok) {
      setError(data.error ?? 'Update failed')
      return
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)))
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return
    setLoading(id)
    setError(null)
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    setLoading(null)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Delete failed')
      return
    }
    setUsers((prev) => prev.filter((u) => u.id !== id))
    router.refresh()
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Portfolios</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => {
              const isSelf = user.id === currentUserId
              const busy = loading === user.id
              return (
                <tr key={user.id} className={isSelf ? 'bg-indigo-50/30' : ''}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{user.name ?? '—'}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    {isSelf && <div className="text-xs text-indigo-500 mt-0.5">You</div>}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-6 py-4">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{user._count.portfolios}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      {user.status === 'PENDING' && (
                        <button
                          disabled={busy}
                          onClick={() => patch(user.id, { status: 'ACTIVE' })}
                          className="text-xs px-2.5 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      {user.status === 'ACTIVE' && !isSelf && (
                        <button
                          disabled={busy}
                          onClick={() => patch(user.id, { status: 'DISABLED' })}
                          className="text-xs px-2.5 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                          Disable
                        </button>
                      )}
                      {user.status === 'DISABLED' && (
                        <button
                          disabled={busy}
                          onClick={() => patch(user.id, { status: 'ACTIVE' })}
                          className="text-xs px-2.5 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Enable
                        </button>
                      )}
                      {user.role === 'USER' && (
                        <button
                          disabled={busy}
                          onClick={() => patch(user.id, { role: 'ADMIN' })}
                          className="text-xs px-2.5 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Make Admin
                        </button>
                      )}
                      {user.role === 'ADMIN' && !isSelf && (
                        <button
                          disabled={busy}
                          onClick={() => patch(user.id, { role: 'USER' })}
                          className="text-xs px-2.5 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50"
                        >
                          Remove Admin
                        </button>
                      )}
                      {!isSelf && (
                        <button
                          disabled={busy}
                          onClick={() => deleteUser(user.id)}
                          className="text-xs px-2.5 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
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
    </div>
  )
}
