'use client'

import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'

interface Props {
  portfolioId: string
  pendingCount: number
  hasTransactions: boolean
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onClose])
}

export function PortfolioActionsMenu({ portfolioId, pendingCount, hasTransactions }: Props) {
  const [open, setOpen] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [syncMsg, setSyncMsg] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  async function handleSync() {
    setSyncState('loading')
    setSyncMsg('')
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/sync-dividends`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      setSyncMsg(data.created > 0
        ? `${data.created} dividend${data.created !== 1 ? 's' : ''} queued`
        : 'Already up to date')
      setSyncState('done')
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Sync failed')
      setSyncState('error')
    }
  }

  const navLinks = [
    { href: `/portfolios/${portfolioId}/transactions`, label: 'History' },
    { href: `/portfolios/${portfolioId}/analysis`,     label: 'Analysis' },
    { href: `/portfolios/${portfolioId}/rebalance`,    label: 'Rebalance' },
    { href: `/portfolios/${portfolioId}/tax`,          label: 'Tax Report' },
    { href: `/portfolios/${portfolioId}/goals`,        label: 'Goals' },
  ]

  return (
    <div className="flex items-center gap-2">
      {/* Scrollable: primary + nav links */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-max">
          <Link href={`/portfolios/${portfolioId}/transactions/new`}>
            <Button size="sm">+ Add Transaction</Button>
          </Link>
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href}>
              <Button size="sm" variant="secondary">{l.label}</Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Actions dropdown — outside overflow container so panel isn't clipped */}
      <div ref={ref} className="relative shrink-0">
        <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
            Actions
            <svg className={`ml-1.5 w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </Button>

          {open && (
            <div className="absolute right-0 top-9 w-52 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 z-30">
              {hasTransactions && (
                <>
                  <div className="px-3.5 py-2">
                    <button
                      onClick={handleSync}
                      disabled={syncState === 'loading'}
                      className="w-full flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 hover:text-indigo-700 disabled:opacity-50 text-left"
                    >
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {syncState === 'loading' ? 'Syncing…' : 'Sync Dividends'}
                    </button>
                    {(syncState === 'done' || syncState === 'error') && syncMsg && (
                      <p className={`text-xs mt-1 ml-6 ${syncState === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
                        {syncMsg}
                      </p>
                    )}
                  </div>
                  <div className="border-t border-gray-100 dark:border-slate-700 my-1" />
                </>
              )}

              <Link
                href={`/portfolios/${portfolioId}/transactions/import`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import CSV
              </Link>

              <a
                href={`/api/portfolios/${portfolioId}/export`}
                download
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </a>

              {pendingCount > 0 && (
                <>
                  <div className="border-t border-gray-100 dark:border-slate-700 my-1" />
                  <Link
                    href={`/portfolios/${portfolioId}/inbox`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-3.5 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  >
                    <span className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" />
                      </svg>
                      Inbox
                    </span>
                    <span className="inline-flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-xs font-bold w-5 h-5">{pendingCount}</span>
                  </Link>
                </>
              )}

              <div className="border-t border-gray-100 dark:border-slate-700 my-1" />
              <Link
                href={`/portfolios/${portfolioId}/edit`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Portfolio
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

