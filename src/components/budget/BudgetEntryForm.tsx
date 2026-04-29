'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { type BudgetRow, type BudgetGroup, GROUP_LABELS, BUDGET_GROUPS } from '@/lib/budget'
import { Button } from '@/components/ui/Button'
import { CurrencyInput } from '@/components/ui/CurrencyInput'

interface Props {
  year: number
  month: number
  initialRows: BudgetRow[]
}

export function BudgetEntryForm({ year, month, initialRows }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<BudgetRow[]>(initialRows)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function update(categoryId: string, field: 'budgeted' | 'actual' | 'notes', value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.categoryId === categoryId
          ? { ...r, [field]: field === 'notes' ? value : parseFloat(value) || 0 }
          : r,
      ),
    )
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/budget/${year}/${month}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgets: rows.map((r) => ({ categoryId: r.categoryId, amount: r.budgeted })),
          actuals: rows.map((r) => ({ categoryId: r.categoryId, amount: r.actual, notes: r.notes })),
        }),
      })
      setSaved(true)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // Group rows by group, in canonical order
  const grouped = BUDGET_GROUPS.flatMap((group) => {
    const groupRows = rows.filter((r) => r.group === group)
    return groupRows.length > 0 ? [{ group, rows: groupRows }] : []
  })

  return (
    <div className="space-y-6">
      {grouped.map(({ group, rows: groupRows }) => (
        <div key={group}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {GROUP_LABELS[group as BudgetGroup]}
          </h3>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_130px_130px] gap-3 px-4 py-2 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700 text-xs text-gray-400 font-medium">
              <span>Category</span>
              <span className="text-right">Budgeted</span>
              <span className="text-right">Actual</span>
            </div>
            {groupRows.map((row, i) => {
              const over = row.actual > row.budgeted && row.budgeted > 0
              return (
                <div
                  key={row.categoryId}
                  className={`grid grid-cols-[1fr_130px_130px] gap-3 px-4 py-2.5 items-center ${
                    i < groupRows.length - 1 ? 'border-b border-gray-50 dark:border-slate-700/50' : ''
                  }`}
                >
                  <span className="text-sm text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                    {row.icon && <span>{row.icon}</span>}
                    {row.name}
                  </span>
                  <div>
                    <CurrencyInput
                      value={row.budgeted === 0 ? '' : String(row.budgeted)}
                      onChange={(v) => update(row.categoryId, 'budgeted', v)}
                      placeholder="0"
                      className="w-full text-right text-sm px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <CurrencyInput
                      value={row.actual === 0 ? '' : String(row.actual)}
                      onChange={(v) => update(row.categoryId, 'actual', v)}
                      placeholder="0"
                      className={`w-full text-right text-sm px-2 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                        over
                          ? 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-700 text-red-700 dark:text-red-400'
                          : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100'
                      }`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save budget'}
        </Button>
        {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>}
      </div>
    </div>
  )
}
