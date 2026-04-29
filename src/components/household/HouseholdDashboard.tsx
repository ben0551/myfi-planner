'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import type { HouseholdSummary } from '@/app/api/household/summary/route'

interface MemberInfo {
  id: string
  userId: string
  role: string
  name: string | null
  email: string | null
}

interface HouseholdInfo {
  id: string
  name: string
  inviteCode: string
  members: MemberInfo[]
}

interface MembershipInfo {
  role: string
  household: HouseholdInfo
}

interface Props {
  currentUserId: string
  initialMembership: MembershipInfo | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function SummaryTile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(value, 'AUD')}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </Card>
  )
}

function displayName(name: string | null, email: string | null) {
  return name || email?.split('@')[0] || 'Member'
}

function MemberBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.max(2, (value / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
        <span>{label}</span>
        <span>{formatCurrency(value, 'AUD')}</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── No household: create or join ────────────────────────────────────────────

function NoHousehold({ onJoined }: { onJoined: () => void }) {
  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setLoading(true); setError(null)
    const res = await fetch('/api/household', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    setLoading(false)
    if (res.ok) { onJoined() } else { const d = await res.json(); setError(d.error) }
  }

  async function join() {
    setLoading(true); setError(null)
    const res = await fetch('/api/household/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inviteCode: code }) })
    setLoading(false)
    if (res.ok) { onJoined() } else { const d = await res.json(); setError(d.error) }
  }

  return (
    <Card>
      <div className="text-center py-6">
        <div className="text-4xl mb-3">🏠</div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Household Yet</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          Create a household to see combined net worth with family members, or join one with an invite code.
        </p>

        {mode === 'none' && (
          <div className="flex gap-3 justify-center">
            <button onClick={() => setMode('create')} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              Create Household
            </button>
            <button onClick={() => setMode('join')} className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
              Join with Code
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="max-w-xs mx-auto space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Household name (e.g. Fischer Family)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={create} disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {loading ? 'Creating…' : 'Create'}
              </button>
              <button onClick={() => { setMode('none'); setError(null) }} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="max-w-xs mx-auto space-y-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste invite code"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-mono bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={join} disabled={loading || !code.trim()} className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {loading ? 'Joining…' : 'Join'}
              </button>
              <button onClick={() => { setMode('none'); setError(null) }} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Main dashboard ──────────────────────────────────────────────────────────

export function HouseholdDashboard({ currentUserId, initialMembership }: Props) {
  const [membership, setMembership] = useState<MembershipInfo | null>(initialMembership)
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const { data: summary, mutate: mutateSummary } = useSWR<HouseholdSummary>(
    membership ? '/api/household/summary' : null,
    fetcher,
    { refreshInterval: 120_000 }
  )

  const refresh = useCallback(async () => {
    const res = await fetch('/api/household')
    if (res.ok) {
      const data = await res.json()
      if (data) {
        setMembership({
          role: data.role,
          household: {
            id: data.household.id,
            name: data.household.name,
            inviteCode: data.household.inviteCode,
            members: data.household.members.map((m: { id: string; userId: string; role: string; user: { name: string | null; email: string | null } }) => ({
              id: m.id,
              userId: m.userId,
              role: m.role,
              name: m.user.name,
              email: m.user.email,
            })),
          },
        })
        mutateSummary()
      } else {
        setMembership(null)
      }
    }
  }, [mutateSummary])

  function copyCode() {
    if (!membership) return
    navigator.clipboard.writeText(membership.household.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function leave() {
    if (!confirm(membership?.role === 'OWNER' ? 'Dissolve the household for all members?' : 'Leave this household?')) return
    setLeaving(true)
    await fetch('/api/household', { method: 'DELETE' })
    setLeaving(false)
    setMembership(null)
    mutateSummary(undefined)
  }

  async function removeMember(userId: string) {
    setRemovingId(userId)
    await fetch('/api/household/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setRemovingId(null)
    refresh()
  }

  if (!membership) {
    return <NoHousehold onJoined={refresh} />
  }

  const { household } = membership
  const isOwner = membership.role === 'OWNER'
  const totalNetWorth = summary?.combined.netWorth ?? 0

  const memberColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-violet-500']

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏠</span>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{household.name}</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {household.members.length} member{household.members.length !== 1 ? 's' : ''}
              {isOwner && ' · You are the owner'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <button onClick={copyCode} className="text-xs px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-mono">
                {copied ? '✓ Copied!' : `Invite code: ${household.inviteCode.slice(0, 8)}…`}
              </button>
            )}
            <button onClick={leave} disabled={leaving} className="text-xs px-3 py-1.5 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50">
              {leaving ? '…' : isOwner ? 'Dissolve' : 'Leave'}
            </button>
          </div>
        </div>

        {/* Member list */}
        <div className="mt-4 flex flex-wrap gap-2">
          {household.members.map((m, i) => (
            <div key={m.userId} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span className={`w-2 h-2 rounded-full ${memberColors[i % memberColors.length]}`} />
              <span className="text-sm text-gray-700 dark:text-slate-300">
                {displayName(m.name, m.email)}
                {m.userId === currentUserId && ' (you)'}
                {m.role === 'OWNER' && ' 👑'}
              </span>
              {isOwner && m.userId !== currentUserId && (
                <button
                  onClick={() => removeMember(m.userId)}
                  disabled={removingId === m.userId}
                  className="text-gray-400 hover:text-red-500 transition-colors ml-1 text-xs"
                  title="Remove from household"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Combined totals */}
      {summary ? (
        <>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Combined Household Wealth</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <SummaryTile label="Net Worth" value={summary.combined.netWorth} />
              <SummaryTile label="Shares" value={summary.combined.sharesValue} />
              <SummaryTile label="Property Equity" value={summary.combined.propertyEquity} sub={`Gross ${formatCurrency(summary.combined.propertyGrossValue, 'AUD')}`} />
              <SummaryTile label="Super" value={summary.combined.superBalance} />
              <SummaryTile label="Cash" value={summary.combined.cashBalance} />
            </div>
          </div>

          {/* Per-member breakdown */}
          {summary.members.length > 1 && (
            <Card>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">By Member</h2>
              <div className="space-y-6">
                {summary.members.map((m, i) => (
                  <div key={m.userId}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${memberColors[i % memberColors.length]}`} />
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {displayName(m.name, m.email)}
                          {m.userId === currentUserId && ' (you)'}
                        </span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {formatCurrency(m.netWorth, 'AUD')}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {m.sharesValue > 0 && <MemberBar label="Shares" value={m.sharesValue} total={totalNetWorth} color={memberColors[i % memberColors.length]} />}
                      {m.propertyEquity > 0 && <MemberBar label="Property equity" value={m.propertyEquity} total={totalNetWorth} color={memberColors[i % memberColors.length]} />}
                      {m.superBalance > 0 && <MemberBar label="Super" value={m.superBalance} total={totalNetWorth} color={memberColors[i % memberColors.length]} />}
                      {m.cashBalance > 0 && <MemberBar label="Cash" value={m.cashBalance} total={totalNetWorth} color={memberColors[i % memberColors.length]} />}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Debt summary if any */}
          {summary.combined.propertyDebt > 0 && (
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Total Mortgage Debt</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Gross property value {formatCurrency(summary.combined.propertyGrossValue, 'AUD')}
                  </p>
                </div>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(summary.combined.propertyDebt, 'AUD')}
                </p>
              </div>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-sm text-gray-500 dark:text-slate-400">Loading wealth data…</div>
      )}
    </div>
  )
}
