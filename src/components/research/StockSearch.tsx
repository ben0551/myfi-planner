'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Result {
  ticker: string
  name: string
  type: string
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function StockSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 200)

  // Fetch suggestions
  useEffect(() => {
    const q = debouncedQuery.trim()
    if (q.length < 1) { setResults([]); setOpen(false); return }

    let cancelled = false
    setLoading(true)
    fetch(`/api/research/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data: Result[]) => {
        if (cancelled) return
        setResults(data)
        setOpen(data.length > 0)
        setHighlighted(-1)
      })
      .catch(() => {/* silent */})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [debouncedQuery])

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const navigate = useCallback((ticker: string) => {
    setOpen(false)
    setQuery('')
    router.push(`/research/${ticker}`)
  }, [router])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (highlighted >= 0 && results[highlighted]) {
      navigate(results[highlighted].ticker)
      return
    }
    const t = query.trim().toUpperCase().replace(/\.AX$/i, '')
    if (t) navigate(t)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const el = listRef.current.children[highlighted] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={onSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search ASX stocks — ticker or company name"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-8"
          />
          {loading && (
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
        >
          Research →
        </button>
      </form>

      {open && results.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto"
        >
          {results.map((r, i) => (
            <li key={r.ticker}>
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); navigate(r.ticker) }}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                  i === highlighted ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-semibold text-gray-900 text-sm shrink-0 w-14">{r.ticker}</span>
                  <span className="text-sm text-gray-600 truncate">{r.name}</span>
                </div>
                <span className={`text-xs shrink-0 ml-2 px-1.5 py-0.5 rounded-full ${
                  r.type === 'ETF' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {r.type}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
