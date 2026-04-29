'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'

interface ParsedTx {
  type: string
  ticker: string
  date: string
  quantity: number
  price: number
  fees: number
  amount: number | null
  frankingPct: number
  notes: string | null
}

interface ParseError {
  row: number
  message: string
}

interface PreviewResult {
  parsed: ParsedTx[]
  errors: ParseError[]
  total: number
}

// Parse CSV text into an array of row-objects keyed by lowercased header
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }

  function splitLine(line: string): string[] {
    const result: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        result.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur)
    return result
  }

  const headers = splitLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/[^a-z%]/g, ''))
  const rows = lines.slice(1).filter((l) => l.trim()).map((line) => {
    const cells = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim() })
    return row
  })
  return { headers, rows }
}

export default function ImportTransactionsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const fileRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  function handleFile(file: File) {
    setFileError(null)
    setPreview(null)
    setDone(false)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { rows: parsed } = parseCsv(text)
      if (parsed.length === 0) {
        setFileError('No rows found. Make sure the file has a header row and at least one data row.')
        return
      }
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  async function runPreview() {
    setLoading(true)
    try {
      const res = await fetch(`/api/portfolios/${id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, preview: true }),
      })
      const data = await res.json()
      setPreview(data)
    } finally {
      setLoading(false)
    }
  }

  async function runImport() {
    setImporting(true)
    try {
      const res = await fetch(`/api/portfolios/${id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      if (!res.ok) {
        const data = await res.json()
        setPreview((prev) => prev ? { ...prev, errors: data.errors ?? [] } : null)
        return
      }
      setDone(true)
      setTimeout(() => router.push(`/portfolios/${id}/transactions`), 1500)
    } finally {
      setImporting(false)
    }
  }

  const typeColor: Record<string, string> = {
    BUY: 'text-green-700 bg-green-50',
    SELL: 'text-red-700 bg-red-50',
    DIVIDEND: 'text-indigo-700 bg-indigo-50',
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Transactions</h1>
        <Link href={`/portfolios/${id}/transactions`} className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Back to transactions
        </Link>
      </div>

      {/* Format guide */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 text-sm">
        <p className="font-semibold text-indigo-800 mb-2">Expected CSV format</p>
        <p className="text-indigo-700 mb-3">
          The file must have a header row with these columns (order flexible, case-insensitive):
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs text-left border-collapse">
            <thead>
              <tr className="text-indigo-600">
                {['Date', 'Type', 'Ticker', 'Quantity', 'Price', 'Fees', 'Amount', 'Franking %', 'Notes'].map((h) => (
                  <th key={h} className="border border-indigo-200 px-2 py-1 bg-indigo-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="text-indigo-900">
                <td className="border border-indigo-200 px-2 py-1">2022-03-15</td>
                <td className="border border-indigo-200 px-2 py-1">BUY</td>
                <td className="border border-indigo-200 px-2 py-1">CBA</td>
                <td className="border border-indigo-200 px-2 py-1">100</td>
                <td className="border border-indigo-200 px-2 py-1">98.50</td>
                <td className="border border-indigo-200 px-2 py-1">9.95</td>
                <td className="border border-indigo-200 px-2 py-1"></td>
                <td className="border border-indigo-200 px-2 py-1">0</td>
                <td className="border border-indigo-200 px-2 py-1"></td>
              </tr>
              <tr className="text-indigo-900">
                <td className="border border-indigo-200 px-2 py-1">2023-09-01</td>
                <td className="border border-indigo-200 px-2 py-1">DIVIDEND</td>
                <td className="border border-indigo-200 px-2 py-1">CBA</td>
                <td className="border border-indigo-200 px-2 py-1">0</td>
                <td className="border border-indigo-200 px-2 py-1">0</td>
                <td className="border border-indigo-200 px-2 py-1">0</td>
                <td className="border border-indigo-200 px-2 py-1">215.00</td>
                <td className="border border-indigo-200 px-2 py-1">100</td>
                <td className="border border-indigo-200 px-2 py-1">Interim div</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-indigo-600">
          Type must be <strong>BUY</strong>, <strong>SELL</strong>, or <strong>DIVIDEND</strong>.
          You can export your existing transactions as a template using the Export button on the transactions page.
        </p>
      </div>

      {/* File picker */}
      {!done && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-indigo-400 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <p className="text-gray-500 text-sm">
            {rows.length > 0
              ? <span className="text-indigo-700 font-medium">{rows.length} rows loaded — ready to preview</span>
              : 'Click or drag a CSV file here'}
          </p>
          {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}
        </div>
      )}

      {rows.length > 0 && !preview && !done && (
        <div className="flex justify-end">
          <Button onClick={runPreview} loading={loading}>Preview Import</Button>
        </div>
      )}

      {/* Preview results */}
      {preview && !done && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">{preview.total} rows in file</span>
            <span className="text-green-700 font-medium">{preview.parsed.length} valid</span>
            {preview.errors.length > 0 && (
              <span className="text-red-600 font-medium">{preview.errors.length} errors</span>
            )}
          </div>

          {preview.errors.length > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-1">
              <p className="text-sm font-semibold text-red-800 mb-2">Validation errors (fix and re-upload)</p>
              {preview.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-700">Row {err.row}: {err.message}</p>
              ))}
            </div>
          )}

          {preview.parsed.length > 0 && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                      <tr className="text-gray-500 uppercase tracking-wide text-left">
                        {['Date', 'Type', 'Ticker', 'Qty', 'Price', 'Fees', 'Amount', 'Franking%', 'Notes'].map((h) => (
                          <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {preview.parsed.map((tx, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700 tabular-nums">{tx.date.split('T')[0]}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${typeColor[tx.type] ?? ''}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-semibold text-gray-900">{tx.ticker}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700">{tx.quantity || '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700">{tx.price ? `$${tx.price}` : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{tx.fees ? `$${tx.fees}` : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700">{tx.amount != null ? `$${tx.amount}` : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{tx.frankingPct ? `${tx.frankingPct}%` : '—'}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">{tx.notes ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {preview.errors.length === 0 && (
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => { setPreview(null); setRows([]) }}>
                    Cancel
                  </Button>
                  <Button onClick={runImport} loading={importing}>
                    Import {preview.parsed.length} Transactions
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {done && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
          <p className="text-green-800 font-semibold text-lg">Import complete!</p>
          <p className="text-green-700 text-sm mt-1">Redirecting to transactions…</p>
        </div>
      )}
    </div>
  )
}
