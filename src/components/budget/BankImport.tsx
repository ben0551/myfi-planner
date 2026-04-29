'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { parseBankCSV, suggestCategory } from '@/lib/bankCsv'
import type { BankTransaction } from '@/lib/bankCsv'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate, gainClass } from '@/lib/formatters'

interface Category {
  id: string
  name: string
  group: string
  icon: string | null
}

interface Props {
  categories: Category[]
}

interface ParsedRow extends BankTransaction {
  id: string
  categoryId: string | null   // null = uncategorised / skip
  include: boolean
}

type Mode = 'replace' | 'add'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function BankImport({ categories }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [detectedFormat, setDetectedFormat] = useState('')
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>('replace')
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<{ entries: number; months: number } | null>(null)
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [filterType, setFilterType] = useState<'all' | 'debit' | 'credit'>('debit')

  // Category lookup map for suggestions
  const categoryByName = useMemo(
    () => new Map(categories.map((c) => [c.name, c.id])),
    [categories]
  )

  // Available months in the parsed data
  const months = useMemo(() => {
    const seen = new Set<string>()
    for (const r of rows) {
      const key = `${r.date.getUTCFullYear()}-${String(r.date.getUTCMonth() + 1).padStart(2, '0')}`
      seen.add(key)
    }
    return [...seen].sort()
  }, [rows])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = parseBankCSV(text)
      setDetectedFormat(result.detectedFormat)
      setParseErrors(result.errors)
      setImported(null)

      const parsed: ParsedRow[] = result.transactions.map((tx, i) => {
        const suggested = suggestCategory(tx.description)
        const categoryId = suggested ? (categoryByName.get(suggested) ?? null) : null
        return {
          ...tx,
          id: String(i),
          categoryId,
          include: true,
        }
      })
      setRows(parsed)
      if (result.transactions.length > 0) {
        setFilterMonth('all')
        setFilterType('debit')
      }
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = parseBankCSV(ev.target?.result as string)
      setDetectedFormat(result.detectedFormat)
      setParseErrors(result.errors)
      setImported(null)
      const parsed: ParsedRow[] = result.transactions.map((tx, i) => {
        const suggested = suggestCategory(tx.description)
        return { ...tx, id: String(i), categoryId: suggested ? (categoryByName.get(suggested) ?? null) : null, include: true }
      })
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  function setCategory(id: string, categoryId: string | null) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, categoryId } : r))
  }

  function toggleInclude(id: string) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, include: !r.include } : r))
  }

  function bulkSetCategory(description: string, categoryId: string | null) {
    // Apply the same category to all rows with matching description stem
    const stem = description.slice(0, 12).toLowerCase()
    setRows((prev) => prev.map((r) =>
      r.description.toLowerCase().startsWith(stem) ? { ...r, categoryId } : r
    ))
  }

  // Filtered view
  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterMonth !== 'all') {
        const key = `${r.date.getUTCFullYear()}-${String(r.date.getUTCMonth() + 1).padStart(2, '0')}`
        if (key !== filterMonth) return false
      }
      if (filterType === 'debit' && r.amount >= 0) return false
      if (filterType === 'credit' && r.amount < 0) return false
      return true
    })
  }, [rows, filterMonth, filterType])

  // Summary: by month × category
  const summary = useMemo(() => {
    const map = new Map<string, { categoryId: string; categoryName: string; year: number; month: number; amount: number }>()
    for (const r of rows) {
      if (!r.include || !r.categoryId) continue
      if (r.amount >= 0) continue  // skip income/credits in expense summary
      const cat = categories.find((c) => c.id === r.categoryId)
      if (!cat) continue
      const year = r.date.getUTCFullYear()
      const month = r.date.getUTCMonth() + 1
      const key = `${r.categoryId}|${year}|${month}`
      const existing = map.get(key)
      if (existing) {
        existing.amount += Math.abs(r.amount)
      } else {
        map.set(key, { categoryId: r.categoryId, categoryName: cat.name, year, month, amount: Math.abs(r.amount) })
      }
    }
    return [...map.values()].sort((a, b) => {
      const dateA = a.year * 100 + a.month
      const dateB = b.year * 100 + b.month
      return dateA !== dateB ? dateA - dateB : a.categoryName.localeCompare(b.categoryName)
    })
  }, [rows, categories])

  const uncategorisedCount = rows.filter((r) => r.include && !r.categoryId && r.amount < 0).length
  const includedCount = rows.filter((r) => r.include).length

  async function handleImport() {
    if (summary.length === 0) {
      toast.error('No categorised expense rows to import')
      return
    }
    setImporting(true)
    try {
      const res = await fetch('/api/bank-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: summary.map((s) => ({ categoryId: s.categoryId, year: s.year, month: s.month, amount: s.amount })), mode }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Import failed')
        return
      }
      const data = await res.json()
      const uniqueMonths = new Set(summary.map((s) => `${s.year}-${s.month}`)).size
      setImported({ entries: data.imported, months: uniqueMonths })
      toast.success(`Imported ${data.imported} category entries across ${uniqueMonths} month${uniqueMonths > 1 ? 's' : ''}`)
    } finally {
      setImporting(false)
    }
  }

  function monthLabel(key: string) {
    const [y, m] = key.split('-')
    return `${MONTHS[+m - 1]} ${y}`
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <Card>
        <div
          className="border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <p className="text-2xl mb-3">🏦</p>
          <p className="font-semibold text-gray-700 dark:text-slate-300 mb-1">Drop your bank CSV here</p>
          <p className="text-sm text-gray-400 mb-5">
            Works with CBA, ANZ, NAB, Westpac, Up Bank, ING, Bendigo
          </p>
          <label className="cursor-pointer">
            <span className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
              Browse file
            </span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
          </label>
          <p className="text-xs text-gray-400 mt-4">
            Download your statement from internet banking and export as CSV.
            All processing happens locally — your data stays on your server.
          </p>
        </div>

        {parseErrors.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Parse errors</p>
            {parseErrors.map((e, i) => <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>)}
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">

      {/* Format + stats bar */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="blue">{detectedFormat} format</Badge>
            <span className="text-sm text-gray-600 dark:text-slate-400">{rows.length} transactions parsed</span>
            {uncategorisedCount > 0 && (
              <span className="text-sm text-amber-600 dark:text-amber-400">{uncategorisedCount} uncategorised</span>
            )}
          </div>
          <label className="text-sm text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">
            Load different file
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
          </label>
        </div>
        {parseErrors.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3">
            {parseErrors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-400">{e}</p>)}
            {parseErrors.length > 5 && <p className="text-xs text-amber-600 mt-1">…and {parseErrors.length - 5} more</p>}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Transaction list */}
        <div className="xl:col-span-2 space-y-4">

          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-3 py-1.5 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All months</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>

            <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden text-sm">
              {(['all', 'debit', 'credit'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 transition-colors ${filterType === t ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                >
                  {t === 'all' ? 'All' : t === 'debit' ? 'Expenses' : 'Income'}
                </button>
              ))}
            </div>

            <span className="text-xs text-gray-400">{visibleRows.length} rows</span>
          </div>

          <Card padding={false}>
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                  <tr className="border-b border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium w-8"></th>
                    <th className="px-2 py-3 text-left font-medium">Date</th>
                    <th className="px-2 py-3 text-left font-medium">Description</th>
                    <th className="px-2 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {visibleRows.map((row) => {
                    const isExpense = row.amount < 0
                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${row.include ? 'hover:bg-gray-50 dark:hover:bg-slate-700/50' : 'opacity-40'}`}
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={() => toggleInclude(row.id)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-2 py-2.5 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                          {row.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                        </td>
                        <td className="px-2 py-2.5 max-w-[220px]">
                          <p className="truncate text-gray-800 dark:text-slate-200" title={row.description}>
                            {row.description}
                          </p>
                        </td>
                        <td className={`px-2 py-2.5 text-right font-medium ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {isExpense ? '-' : '+'}{formatCurrency(Math.abs(row.amount), 'AUD')}
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={row.categoryId ?? ''}
                            onChange={(e) => {
                              const val = e.target.value || null
                              setCategory(row.id, val)
                              // Offer bulk: if user holds Shift, apply to matching descriptions
                              bulkSetCategory(row.description, val)
                            }}
                            className="w-full rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs px-2 py-1 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">— skip —</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.icon ? `${c.icon} ` : ''}{c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                        No transactions match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Import summary + controls */}
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Import summary</h2>

            {summary.length === 0 ? (
              <p className="text-sm text-gray-400">Categorise some expense rows to see the import preview.</p>
            ) : (
              <>
                <div className="space-y-1 mb-4 max-h-64 overflow-y-auto pr-1">
                  {summary.map((s) => (
                    <div key={`${s.categoryId}|${s.year}|${s.month}`} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <span className="text-gray-600 dark:text-slate-400 text-xs">{MONTHS[s.month - 1]} {s.year} · </span>
                        <span className="text-gray-800 dark:text-slate-200 truncate">{s.categoryName}</span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white shrink-0">
                        {formatCurrency(s.amount, 'AUD')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 dark:border-slate-700 pt-3 mb-4">
                  <div className="flex justify-between text-sm font-semibold text-gray-900 dark:text-white">
                    <span>Total expenses</span>
                    <span>{formatCurrency(summary.reduce((s, r) => s + r.amount, 0), 'AUD')}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {summary.length} category-month entries · {new Set(summary.map(s => `${s.year}-${s.month}`)).size} month(s)
                  </p>
                </div>
              </>
            )}

            {/* Mode toggle */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">If a budget actual already exists</p>
              <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden text-sm">
                <button
                  onClick={() => setMode('replace')}
                  className={`flex-1 px-3 py-2 transition-colors ${mode === 'replace' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                >
                  Replace
                </button>
                <button
                  onClick={() => setMode('add')}
                  className={`flex-1 px-3 py-2 transition-colors ${mode === 'add' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                >
                  Add to existing
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {mode === 'replace'
                  ? 'Sets the actual amount to the CSV total (recommended for full-month imports)'
                  : 'Adds the CSV total to whatever is already recorded (for partial imports)'}
              </p>
            </div>

            <Button
              className="w-full"
              disabled={summary.length === 0 || importing}
              onClick={handleImport}
            >
              {importing ? 'Importing…' : `Import ${summary.length} entr${summary.length === 1 ? 'y' : 'ies'}`}
            </Button>

            {imported && (
              <div className="mt-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-400">
                ✓ Imported {imported.entries} entries across {imported.months} month(s).{' '}
                <button
                  onClick={() => router.push('/budget')}
                  className="underline hover:no-underline"
                >
                  View budget →
                </button>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">How it works</h3>
            <ol className="text-xs text-gray-500 dark:text-slate-400 space-y-1.5 list-decimal list-inside">
              <li>Download your statement as CSV from internet banking</li>
              <li>Drop the file above — column order is detected automatically</li>
              <li>Review auto-categorised transactions, fix any mismatches</li>
              <li>Transactions with the same description are bulk-updated when you change a category</li>
              <li>Click Import to write totals to your budget actuals</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}
