'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Props {
  initialAddress: string | null
  initialToken: string
  domain: string | null
  configured: boolean
}

export function EmailImportCard({ initialAddress, initialToken, domain, configured }: Props) {
  const router = useRouter()
  const [address, setAddress] = useState(initialAddress)
  const [token, setToken] = useState(initialToken)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  async function copy() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerate() {
    if (!confirm('This will invalidate your current import address. Any email rules pointing to the old address will stop working. Continue?')) return
    setRegenerating(true)
    const res = await fetch('/api/user/email-import', { method: 'POST' })
    const data = await res.json()
    setAddress(data.address)
    setToken(data.token)
    setRegenerating(false)
    router.refresh()
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Email Import</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Forward broker emails to your personal import address and they appear as pending transactions automatically.
          </p>
        </div>
        {configured && (
          <span className="shrink-0 ml-4 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            Active
          </span>
        )}
      </div>

      {!configured ? (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm space-y-3">
          <p className="font-medium text-amber-800 dark:text-amber-300">Mailgun not configured</p>
          <p className="text-amber-700 dark:text-amber-400">
            The instance admin needs to set <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded font-mono text-xs">MAILGUN_IMPORT_DOMAIN</code> and{' '}
            <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded font-mono text-xs">MAILGUN_WEBHOOK_SIGNING_KEY</code> in the environment to enable email import.
          </p>
          <p className="text-amber-700 dark:text-amber-400">
            See the <a href="https://github.com/ben0551/myfi-planner/blob/master/API.md" target="_blank" rel="noopener noreferrer" className="underline">setup guide</a> for instructions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Import address */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Your import address
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-slate-100 select-all">
                {address}
              </div>
              <Button size="sm" variant="secondary" onClick={copy}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Keep this address private — anyone with it can add transactions to your account.
            </p>
          </div>

          {/* How to use */}
          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 p-4 space-y-3 text-sm text-gray-700 dark:text-slate-300">
            <p className="font-medium text-gray-900 dark:text-slate-100">How to use</p>
            <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-slate-400">
              <li>
                Copy your import address above.
              </li>
              <li>
                In your email client, create a forwarding rule for emails from your broker
                (e.g. <span className="font-mono text-xs bg-gray-100 dark:bg-slate-700 px-1 rounded">no-reply@stake.com.au</span>).
              </li>
              <li>
                Set the rule to forward matching emails to your import address.
              </li>
              <li>
                Forwarded emails are parsed automatically and appear in{' '}
                <strong>Email Import → Pending Transactions</strong> within seconds.
              </li>
            </ol>
          </div>

          {/* Supported brokers */}
          <div className="text-sm text-gray-600 dark:text-slate-400">
            <span className="font-medium text-gray-700 dark:text-slate-300">Supported brokers: </span>
            Stake, CommSec (partial) — the parser uses heuristic matching so most plain-text broker emails will work.
            Always review parsed transactions before confirming.
          </div>

          {/* Regenerate */}
          <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
            <p className="text-xs text-gray-500 dark:text-slate-500 mb-2">
              If your address is compromised, regenerate it. Your old address will stop working immediately.
            </p>
            <Button size="sm" variant="ghost" onClick={regenerate} disabled={regenerating}>
              {regenerating ? 'Regenerating…' : 'Regenerate address'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
