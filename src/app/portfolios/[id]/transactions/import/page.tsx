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

// ── CSV parser ────────────────────────────────────────────────────────────────

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

// ── Excel parser (SheetJS, lazy-loaded) ──────────────────────────────────────

function cleanHeader(h: string): string {
  return String(h).trim().toLowerCase().replace(/[^a-z%]/g, '')
}

async function parseXlsx(file: File): Promise<{ headers: string[]; rows: Record<string, string>[]; isStake: boolean }> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { cellDates: true })

  // Detect Stake: has sheets named like "Aus Equities" / "Wall St Equities"
  const isStake = workbook.SheetNames.some((n) => /aus equities|wall st equities/i.test(n))

  // Select which sheets to read: equity sheets for Stake, otherwise all non-meta sheets
  const dataSheets = isStake
    ? workbook.SheetNames.filter((n) => /equities/i.test(n))
    : workbook.SheetNames.filter((n) => !/disclaimer|summary|readme|info/i.test(n))

  if (dataSheets.length === 0) {
    return { headers: [], rows: [], isStake }
  }

  let headers: string[] = []
  const allRows: Record<string, string>[] = []

  for (const sheetName of dataSheets) {
    const sheet = workbook.Sheets[sheetName]
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false, // use formatted strings (handles dates nicely)
    })
    if (raw.length === 0) continue

    const sheetRows = raw.map((row) => {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        out[cleanHeader(k)] = String(v ?? '').trim()
      }
      return out
    })

    if (headers.length === 0) headers = Object.keys(sheetRows[0])
    allRows.push(...sheetRows)
  }

  return { headers, rows: allRows, isStake }
}

// ── Broker definitions ────────────────────────────────────────────────────────

type BrokerKey = 'native' | 'stake' | 'commsec'

interface BrokerDef {
  label: string
  /** Cleaned header tokens that uniquely identify this broker's export format */
  signature: string[]
  normalize: (row: Record<string, string>) => Record<string, string>
}

const BROKERS: Record<BrokerKey, BrokerDef> = {
  native: {
    label: 'MyFi native format',
    signature: ['type', 'ticker', 'quantity'],
    normalize: (row) => row,
  },
  stake: {
    label: 'Stake',
    signature: ['tradedate', 'symbol', 'side', 'units', 'avgprice'],
    normalize: (row) => ({
      date: row['tradedate'] ?? '',
      // "Buy" → "BUY", "Sell" → "SELL"
      type: (row['side'] ?? '').toUpperCase(),
      // Strip exchange suffix: "ACL.ASX" → "ACL", "AAPL" stays "AAPL"
      ticker: (row['symbol'] ?? '').replace(/\.[A-Za-z]+$/, ''),
      // Stake uses negative units/price for SELL — normalise to positive
      quantity: String(Math.abs(parseFloat(row['units'] ?? '0') || 0)),
      price: String(Math.abs(parseFloat(row['avgprice'] ?? '0') || 0)),
      // fees + gst = total brokerage cost
      fees: String((parseFloat(row['fees'] ?? '0') || 0) + (parseFloat(row['gst'] ?? '0') || 0)),
      amount: '',
      'franking%': '0',
      notes: row['tradeidentifier'] ?? '',
    }),
  },
  commsec: {
    label: 'CommSec',
    signature: ['datetime', 'type', 'details', 'debit', 'credit', 'balance'],
    normalize: (row) => row,
  },
}

function detectBroker(cleanedHeaders: string[]): BrokerKey {
  const headerSet = new Set(cleanedHeaders)
  for (const [key, def] of Object.entries(BROKERS) as [BrokerKey, BrokerDef][]) {
    if (key === 'native') continue
    if (def.signature.every((h) => headerSet.has(h))) return key
  }
  return 'native'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ImportTransactionsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const fileRef = useRef<HTMLInputElement>(null)

  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [broker, setBroker] = useState<BrokerKey>('native')
  const [autoDetected, setAutoDetected] = useState<BrokerKey | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFile(file: File) {
    setFileError(null)
    setPreview(null)
    setDone(false)
    setFileName(file.name)

    const isXlsx = file.name.toLowerCase().endsWith('.xlsx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    if (isXlsx) {
      try {
        const { headers, rows, isStake } = await parseXlsx(file)
        if (rows.length === 0) {
          setFileError('No data rows found in the Excel file. Check that the file has data sheets.')
          return
        }
        const detected: BrokerKey = isStake ? 'stake' : detectBroker(headers)
        setBroker(detected)
        setAutoDetected(detected)
        setRawRows(rows)
      } catch (err) {
        setFileError(`Could not read Excel file: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
      return
    }

    // CSV path
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers, rows } = parseCsv(text)
      if (rows.length === 0) {
        setFileError('No rows found. Make sure the file has a header row and at least one data row.')
        return
      }
      const detected = detectBroker(headers)
      setBroker(detected)
      setAutoDetected(detected)
      setRawRows(rows)
    }
    reader.readAsText(file)
  }

  function normalizedRows() {
    return rawRows.map(BROKERS[broker].normalize)
  }

  async function runPreview() {
    setLoading(true)
    try {
      const res = await fetch(`/api/portfolios/${id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: normalizedRows(), preview: true }),
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
        body: JSON.stringify({ rows: normalizedRows() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setPreview((prev) => prev ? { ...prev, errors: data.errors ?? [] } : null)
        return
      }
      setDone(true)

      // Pre-warm price cache for imported tickers so portfolio page loads fast
      const importedTickers = [...new Set(
        normalizedRows().map((r) => (r['ticker'] ?? '').toUpperCase()).filter(Boolean)
      )]
      if (importedTickers.length > 0) {
        fetch(`/api/prices?tickers=${importedTickers.join(',')}`)
          .catch(() => {})
      }

      // Backfill portfolio snapshots from historical prices (fire-and-forget)
      fetch(`/api/portfolios/${id}/backfill-history`, { method: 'POST' }).catch(() => {})

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
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 text-sm space-y-3">
        <p className="font-semibold text-indigo-800">Supported formats</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {(Object.entries(BROKERS) as [BrokerKey, BrokerDef][]).map(([key, def]) => (
            <span key={key} className="bg-white border border-indigo-200 text-indigo-700 rounded-full px-3 py-1 font-medium">
              {def.label}
            </span>
          ))}
        </div>
        <p className="text-indigo-700">
          Upload a <strong>CSV</strong> or <strong>Excel (.xlsx)</strong> export from any supported broker — format is detected automatically.
          Stake Excel files with multiple sheets (Aus Equities, Wall St Equities) are merged automatically.
          For the native format, columns must include: Date, Type (BUY/SELL/DIVIDEND), Ticker, Quantity, Price, Fees, Amount, Franking&nbsp;%, Notes.
        </p>
      </div>

      {/* File picker */}
      {!done && (
        <div className="space-y-3">
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
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <p className="text-gray-500 text-sm">
              {rawRows.length > 0
                ? <span className="text-indigo-700 font-medium">{rawRows.length} rows loaded from {fileName} — ready to preview</span>
                : 'Click or drag a CSV or Excel (.xlsx) file here'}
            </p>
            {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}
          </div>

          {/* Broker selector — shown after file is loaded */}
          {rawRows.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">Format:</span>
              <select
                value={broker}
                onChange={(e) => { setBroker(e.target.value as BrokerKey); setPreview(null) }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {(Object.entries(BROKERS) as [BrokerKey, BrokerDef][]).map(([key, def]) => (
                  <option key={key} value={key}>{def.label}</option>
                ))}
              </select>
              {autoDetected && autoDetected === broker && broker !== 'native' && (
                <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                  ✓ Auto-detected
                </span>
              )}
              {autoDetected === 'native' && (
                <span className="text-xs text-gray-500">
                  Format not recognised — using native. Select a broker above if needed.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {rawRows.length > 0 && !preview && !done && (
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
                  <Button variant="secondary" onClick={() => { setPreview(null); setRawRows([]); setAutoDetected(null) }}>
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
