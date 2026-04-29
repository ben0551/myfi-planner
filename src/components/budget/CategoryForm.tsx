'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUDGET_GROUPS, GROUP_LABELS, type BudgetGroup } from '@/lib/budget'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Category {
  id: string
  name: string
  group: string
  icon: string | null
}

interface Props {
  editing?: Category
  onDone?: () => void
}

export function CategoryForm({ editing, onDone }: Props) {
  const router = useRouter()
  const [name, setName] = useState(editing?.name ?? '')
  const [group, setGroup] = useState<BudgetGroup>((editing?.group as BudgetGroup) ?? 'LIVING')
  const [icon, setIcon] = useState(editing?.icon ?? '')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const url = editing ? `/api/budget/categories/${editing.id}` : '/api/budget/categories'
      await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, group, icon }),
      })
      router.refresh()
      if (!editing) {
        setName('')
        setIcon('')
        setGroup('LIVING')
      }
      onDone?.()
    } finally {
      setSaving(false)
    }
  }

  async function deactivate() {
    if (!editing) return
    await fetch(`/api/budget/categories/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    router.refresh()
    onDone?.()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            required
          />
        </div>
        <div>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as BudgetGroup)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {BUDGET_GROUPS.map((g) => (
              <option key={g} value={g}>{GROUP_LABELS[g]}</option>
            ))}
          </select>
        </div>
        <div className="w-20">
          <Input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="emoji"
            maxLength={4}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} size="sm">
          {saving ? 'Saving…' : editing ? 'Update' : 'Add category'}
        </Button>
        {editing && (
          <Button type="button" variant="secondary" size="sm" onClick={deactivate}>
            Deactivate
          </Button>
        )}
        {onDone && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
