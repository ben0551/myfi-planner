'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { PasteImport } from '@/components/email/PasteImport'
import { EmlUpload } from '@/components/email/EmlUpload'
import { ParsePreview } from '@/components/email/ParsePreview'
import { PendingList } from '@/components/email/PendingList'
import useSWR from 'swr'
import type { ParsedTransaction } from '@/lib/email/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Tab = 'paste' | 'upload' | 'smtp'

export default function EmailImportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('paste')
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null)
  const [rawText, setRawText] = useState('')
  const [savedCount, setSavedCount] = useState(0)

  const { data: portfolios = [] } = useSWR('/api/portfolios', fetcher)
  const { data: cashAccounts = [] } = useSWR('/api/wealth/cash', fetcher)

  function handleParsed(result: ParsedTransaction, raw: string) {
    setParsed(result)
    setRawText(raw)
  }

  async function handleSave(overrides: Record<string, unknown>) {
    await fetch('/api/pending-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...overrides, source: activeTab === 'upload' ? 'eml_upload' : 'email_paste' }),
    })
    setParsed(null)
    setRawText('')
    setSavedCount((n) => n + 1)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'paste', label: 'Paste Email Text' },
    { key: 'upload', label: 'Upload .eml File' },
    { key: 'smtp', label: 'SMTP Setup' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Import</h1>
        <p className="text-sm text-gray-500 mt-1">
          Import transactions from broker emails (Stake, etc.)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: import panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 -mx-6 -mt-6 px-6 mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setParsed(null) }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'paste' && !parsed && (
              <PasteImport onParsed={handleParsed} />
            )}
            {activeTab === 'upload' && !parsed && (
              <EmlUpload onParsed={handleParsed} />
            )}
            {activeTab === 'smtp' && (
              <div className="space-y-4 text-sm text-gray-700">
                <h3 className="font-semibold text-gray-900">Local SMTP Server</h3>
                <p>
                  The app includes a local SMTP server running on port{' '}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">2525</code>.
                  Emails forwarded to it are automatically parsed and appear in the Pending list below.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="font-medium text-gray-800">Setup instructions:</p>
                  <ol className="list-decimal list-inside space-y-2 text-gray-600">
                    <li>
                      Start the app with <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">npm run dev</code> — the SMTP server starts automatically on port 2525.
                    </li>
                    <li>
                      In your email client, set up a forwarding rule to send emails from{' '}
                      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">no-reply@stake.com.au</code>{' '}
                      to an address at <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">localhost:2525</code>.
                    </li>
                    <li>
                      Alternatively, use a tool like{' '}
                      <strong>imapfilter</strong> or <strong>Thunderbird</strong> message filters to relay emails to the local SMTP.
                    </li>
                    <li>
                      Forwarded emails appear in the Pending Transactions list within seconds.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {parsed && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Parsed Transaction</h3>
                  <button
                    onClick={() => setParsed(null)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    ← Back
                  </button>
                </div>
                <ParsePreview
                  parsed={parsed}
                  rawText={rawText}
                  portfolios={portfolios}
                  onSave={handleSave as Parameters<typeof ParsePreview>[0]['onSave']}
                  onDiscard={() => setParsed(null)}
                />
              </div>
            )}
          </Card>
        </div>

        {/* Right: pending list */}
        <div>
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">
              Pending Transactions
              {savedCount > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  ({savedCount} saved this session)
                </span>
              )}
            </h2>
            <PendingList portfolios={portfolios} cashAccounts={cashAccounts} />
          </Card>
        </div>
      </div>
    </div>
  )
}
