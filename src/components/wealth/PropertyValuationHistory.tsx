'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface HistoryEntry {
  id: string
  date: string   // ISO string
  value: number
}

interface Props {
  propertyId: string
  history: HistoryEntry[]
  purchasePrice: number
  currency: string
}

function fmtCcy(v: number, currency: string) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function PropertyValuationHistory({ propertyId, history, purchasePrice, currency }: Props) {
  const router = useRouter()
  const [editing, setEditing]     = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDate,  setEditDate]  = useState('')
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)

  function startEdit(entry: HistoryEntry) {
    setEditing(entry.id)
    setEditValue(String(entry.value))
    setEditDate(entry.date.slice(0, 10))
  }

  async function saveEdit(id: string) {
    setLoading(true)
    await fetch(`/api/wealth/properties/${propertyId}/value/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: parseFloat(editValue), date: editDate }),
    })
    setEditing(null)
    setLoading(false)
    router.refresh()
  }

  async function confirmDelete(id: string) {
    setLoading(true)
    await fetch(`/api/wealth/properties/${propertyId}/value/${id}`, { method: 'DELETE' })
    setDeleting(null)
    setLoading(false)
    router.refresh()
  }

  if (history.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Value</th>
            <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Change</th>
            <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">vs Purchase</th>
            <th className="py-2 w-20" />
          </tr>
        </thead>
        <tbody>
          {history.map((entry, i) => {
            const prev       = history[i + 1]
            const change     = prev ? entry.value - prev.value : null
            const vsPurchase = entry.value - purchasePrice

            if (editing === entry.id) {
              return (
                <tr key={entry.id} className="border-b border-indigo-100 bg-indigo-50">
                  <td className="py-2">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-xs w-32"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-xs w-32 text-right"
                    />
                  </td>
                  <td colSpan={2} />
                  <td className="py-2 text-right">
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => saveEdit(entry.id)}
                        disabled={loading}
                        className="px-2 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )
            }

            if (deleting === entry.id) {
              return (
                <tr key={entry.id} className="border-b border-red-100 bg-red-50">
                  <td className="py-2 text-gray-700">{fmtDate(entry.date)}</td>
                  <td className="py-2 text-right font-medium text-gray-900">{fmtCcy(entry.value, currency)}</td>
                  <td colSpan={2} className="py-2 text-center text-xs text-red-700 font-medium">
                    Delete this entry?
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => confirmDelete(entry.id)}
                        disabled={loading}
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleting(null)}
                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )
            }

            return (
              <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                <td className="py-2 text-gray-700">{fmtDate(entry.date)}</td>
                <td className="py-2 text-right font-medium text-gray-900">{fmtCcy(entry.value, currency)}</td>
                <td className={`py-2 text-right text-xs ${
                  change === null ? 'text-gray-400' : change >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {change === null ? '—' : `${change >= 0 ? '+' : ''}${fmtCcy(change, currency)}`}
                </td>
                <td className={`py-2 text-right text-xs ${vsPurchase >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {vsPurchase >= 0 ? '+' : ''}{fmtCcy(vsPurchase, currency)}
                </td>
                <td className="py-2 text-right">
                  <div className="flex gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(entry)}
                      className="px-2 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleting(entry.id)}
                      className="px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
