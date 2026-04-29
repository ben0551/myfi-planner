'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface WeightRow { name: string; pct: number }

interface Classification {
  instrumentType: string | null
  riskCategory: string | null
  assetClasses: WeightRow[]
  industries: WeightRow[]
  regions: WeightRow[]
  customGroups: WeightRow[]
  notes: string | null
}

const INSTRUMENT_TYPES = ['STOCK', 'ETF', 'FUND', 'BOND', 'OTHER'] as const
const RISK_CATEGORIES = ['LOW', 'MEDIUM', 'HIGH'] as const

const INSTRUMENT_LABELS: Record<string, string> = {
  STOCK: 'Stocks', ETF: 'ETFs', FUND: 'Funds', BOND: 'Bonds', OTHER: 'Other',
}
const RISK_LABELS: Record<string, string> = {
  LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High',
}

const COMMON_SECTORS = [
  'Financial Services', 'Basic Materials', 'Technology', 'Consumer Cyclical',
  'Industrials', 'Healthcare', 'Energy', 'Real Estate', 'Consumer Defensive',
  'Communication Services', 'Utilities',
]

const COMMON_REGIONS = [
  'Australia', 'United States', 'United Kingdom', 'Japan', 'China',
  'Europe', 'Emerging Markets', 'Asia Pacific', 'Global',
]

const COMMON_ASSET_CLASSES = ['Equity', 'Fixed Income', 'Cash', 'Property', 'Infrastructure', 'Commodities']

// ── Weight table ───────────────────────────────────────────────────────────────

function WeightTable({
  label,
  rows,
  onChange,
  suggestions,
}: {
  label: string
  rows: WeightRow[]
  onChange: (rows: WeightRow[]) => void
  suggestions: string[]
}) {
  const total = rows.reduce((s, r) => s + r.pct, 0)
  const remaining = Math.max(0, 100 - total)

  function addRow() {
    onChange([...rows, { name: '', pct: remaining }])
  }

  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i))
  }

  function setName(i: number, name: string) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, name } : r))
  }

  function setPct(i: number, pct: number) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, pct: Math.max(0, Math.min(100, pct)) } : r))
  }

  const overAllocated = total > 100.01

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-xs ${overAllocated ? 'text-red-500' : 'text-gray-400'}`}>
          {total.toFixed(0)}% allocated
          {overAllocated && ' (over 100%)'}
        </span>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2 mb-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => setName(i, e.target.value)}
                  placeholder="Name"
                  list={`suggestions-${label}-${i}`}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id={`suggestions-${label}-${i}`}>
                  {suggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div className="flex items-center gap-1 w-28">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={row.pct}
                  onChange={(e) => setPct(i, parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-gray-400 text-sm">%</span>
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
      >
        + Add
      </button>
    </div>
  )
}

// ── Main editor ────────────────────────────────────────────────────────────────

interface Props {
  ticker: string
  companyName?: string | null
  onSaved?: () => void
}

const EMPTY: Classification = {
  instrumentType: null,
  riskCategory: null,
  assetClasses: [],
  industries: [],
  regions: [],
  customGroups: [],
  notes: null,
}

export function TickerClassificationEditor({ ticker, companyName, onSaved }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<Classification>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/tickers/${ticker}/classification`)
      .then((r) => r.json())
      .then((data) => {
        if (data) setForm({ ...EMPTY, ...data })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ticker])

  function set<K extends keyof Classification>(key: K, value: Classification[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/tickers/${ticker}/classification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
      router.refresh()
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Loading…</div>

  return (
    <div className="space-y-6">
      {/* Instrument type */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Instrument Type</p>
        <div className="flex flex-wrap gap-2">
          {INSTRUMENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set('instrumentType', form.instrumentType === t ? null : t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                form.instrumentType === t
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
              }`}
            >
              {INSTRUMENT_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Risk */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Risk Category</p>
        <div className="flex gap-2">
          {RISK_CATEGORIES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set('riskCategory', form.riskCategory === r ? null : r)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                form.riskCategory === r
                  ? r === 'LOW' ? 'bg-emerald-600 text-white border-emerald-600'
                    : r === 'MEDIUM' ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
              }`}
            >
              {RISK_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Asset classes */}
      <WeightTable
        label="Asset Classes"
        rows={form.assetClasses}
        onChange={(rows) => set('assetClasses', rows)}
        suggestions={COMMON_ASSET_CLASSES}
      />

      {/* Industries / GICS */}
      <WeightTable
        label="Industries (GICS)"
        rows={form.industries}
        onChange={(rows) => set('industries', rows)}
        suggestions={COMMON_SECTORS}
      />

      {/* Regions */}
      <WeightTable
        label="Regions"
        rows={form.regions}
        onChange={(rows) => set('regions', rows)}
        suggestions={COMMON_REGIONS}
      />

      {/* Custom groups */}
      <WeightTable
        label="Custom Groups"
        rows={form.customGroups}
        onChange={(rows) => set('customGroups', rows)}
        suggestions={[]}
      />

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows={2}
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value || null)}
          placeholder="Any notes about this holding…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} loading={saving}>Save Classification</Button>
        {saved && <span className="text-sm text-emerald-600">Saved!</span>}
      </div>
    </div>
  )
}
