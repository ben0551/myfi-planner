'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatCurrency } from '@/lib/formatters'

export type PortfolioEntry = {
  id: string
  name: string
  isTD: boolean
  value: number
}

export type PropertyEntry = {
  id: string
  name: string
  subtype: string
  ownershipPct: number
  grossValue: number
  currency: string
  mortgage?: {
    lender: string
    currentBalance: number
    interestRate: number
    loanType: string
    lvr: number
    equity: number
  }
}

export type SuperEntry = {
  id: string
  fundName: string
  balance: number
  currency: string
}

export type CashEntry = {
  id: string
  name: string
  institution: string | null
  balance: number
  currency: string
}

interface Props {
  investments: PortfolioEntry[]
  termDeposits: PortfolioEntry[]
  properties: PropertyEntry[]
  superAccounts: SuperEntry[]
  cashAccounts: CashEntry[]
  totalAssets: number
  totalLiabilities: number
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function GroupRow({
  icon, label, count, total, currency = 'AUD', open, onToggle,
}: {
  icon: string
  label: string
  count: number
  total: number
  currency?: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors text-left"
    >
      <span className="text-base w-5 text-center shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{label}</span>
        <span className="ml-2 text-xs text-gray-400 dark:text-slate-500">{count} {count === 1 ? 'item' : 'items'}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900 dark:text-white mr-2">{formatCurrency(total, currency)}</span>
      <ChevronIcon open={open} />
    </button>
  )
}

function ItemRow({ href, icon, name, sub, value, currency = 'AUD' }: {
  href: string
  icon: string
  name: string
  sub?: string
  value: number
  currency?: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 pl-10 pr-5 py-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors group border-t border-gray-50 dark:border-slate-700/40"
    >
      <span className="text-sm w-5 text-center shrink-0 text-gray-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">{name}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-slate-500">{sub}</p>}
      </div>
      <span className="text-sm font-medium text-gray-800 dark:text-slate-200 shrink-0">{formatCurrency(value, currency)}</span>
      <svg className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

export function WealthBalanceSheet({
  investments, termDeposits, properties, superAccounts, cashAccounts,
  totalAssets, totalLiabilities,
}: Props) {
  const [openAsset, setOpenAsset] = useState<string | null>(null)
  const [openLiab, setOpenLiab] = useState<string | null>(null)

  function toggleAsset(key: string) { setOpenAsset((k) => (k === key ? null : key)) }
  function toggleLiab(key: string) { setOpenLiab((k) => (k === key ? null : key)) }

  const investTotal = investments.reduce((s, p) => s + p.value, 0)
  const tdTotal = termDeposits.reduce((s, p) => s + p.value, 0)
  const propertyTotal = properties.reduce((s, p) => s + p.grossValue, 0)
  const superTotal = superAccounts.reduce((s, a) => s + a.balance, 0)
  const cashTotal = cashAccounts.reduce((s, a) => s + a.balance, 0)

  const propertiesWithMortgage = properties.filter((p) => p.mortgage)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ASSETS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Assets</h2>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(totalAssets)}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-slate-700">

          {investments.length > 0 && (
            <>
              <GroupRow
                icon="📈" label="Investments" count={investments.length} total={investTotal}
                open={openAsset === 'invest'} onToggle={() => toggleAsset('invest')}
              />
              {openAsset === 'invest' && investments.map((p) => (
                <ItemRow key={p.id} href={`/portfolios/${p.id}`} icon="→" name={p.name}
                  sub="Investment portfolio" value={p.value} />
              ))}
            </>
          )}

          {termDeposits.length > 0 && (
            <>
              <GroupRow
                icon="💵" label="Term Deposits" count={termDeposits.length} total={tdTotal}
                open={openAsset === 'td'} onToggle={() => toggleAsset('td')}
              />
              {openAsset === 'td' && termDeposits.map((p) => (
                <ItemRow key={p.id} href={`/portfolios/${p.id}`} icon="→" name={p.name}
                  sub="Term deposit" value={p.value} />
              ))}
            </>
          )}

          {properties.length > 0 && (
            <>
              <GroupRow
                icon="🏠" label="Property" count={properties.length} total={propertyTotal}
                open={openAsset === 'property'} onToggle={() => toggleAsset('property')}
              />
              {openAsset === 'property' && properties.map((p) => (
                <ItemRow key={p.id} href={`/wealth/properties/${p.id}`} icon="→"
                  name={p.name}
                  sub={`${p.subtype}${p.ownershipPct < 100 ? ` · ${p.ownershipPct}% owned` : ''}`}
                  value={p.grossValue} currency={p.currency} />
              ))}
            </>
          )}

          {superAccounts.length > 0 && (
            <>
              <GroupRow
                icon="🦘" label="Superannuation" count={superAccounts.length} total={superTotal}
                open={openAsset === 'super'} onToggle={() => toggleAsset('super')}
              />
              {openAsset === 'super' && superAccounts.map((a) => (
                <ItemRow key={a.id} href={`/wealth/super/${a.id}`} icon="→"
                  name={a.fundName} sub="Superannuation" value={a.balance} currency={a.currency} />
              ))}
            </>
          )}

          {cashAccounts.length > 0 && (
            <>
              <GroupRow
                icon="💰" label="Cash & Savings" count={cashAccounts.length} total={cashTotal}
                open={openAsset === 'cash'} onToggle={() => toggleAsset('cash')}
              />
              {openAsset === 'cash' && cashAccounts.map((a) => (
                <ItemRow key={a.id} href={`/wealth/cash/${a.id}`} icon="→"
                  name={a.name} sub={a.institution ?? 'Cash & savings'}
                  value={a.balance} currency={a.currency} />
              ))}
            </>
          )}

          {totalAssets === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No assets yet — add a portfolio, property, super, or cash account.
            </div>
          )}

          <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-slate-700/30">
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Total Assets</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(totalAssets)}</span>
          </div>
        </div>
      </div>

      {/* LIABILITIES */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Liabilities</h2>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(totalLiabilities)}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-slate-700">

          {propertiesWithMortgage.length > 0 && (
            <>
              <GroupRow
                icon="🏦" label="Mortgages" count={propertiesWithMortgage.length}
                total={propertiesWithMortgage.reduce((s, p) => s + p.mortgage!.currentBalance, 0)}
                open={openLiab === 'mortgage'} onToggle={() => toggleLiab('mortgage')}
              />
              {openLiab === 'mortgage' && propertiesWithMortgage.map((p) => (
                <Link
                  key={p.id}
                  href={`/wealth/properties/${p.id}`}
                  className="block pl-10 pr-5 py-3.5 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors group border-t border-gray-50 dark:border-slate-700/40"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-gray-400">→</span>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                          {p.mortgage!.lender}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {p.name} · {p.mortgage!.interestRate}% p.a. · {p.mortgage!.loanType === 'PI' ? 'P&I' : 'IO'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-200 ml-2 shrink-0">
                      {formatCurrency(p.mortgage!.currentBalance, p.currency)}
                    </span>
                  </div>
                  <div className="ml-5">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>LVR {p.mortgage!.lvr.toFixed(1)}%</span>
                      <span>Equity {formatCurrency(p.mortgage!.equity, p.currency)}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-slate-600/50 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${p.mortgage!.lvr > 80 ? 'bg-red-400' : p.mortgage!.lvr > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(100, p.mortgage!.lvr)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </>
          )}

          {totalLiabilities === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No liabilities — add a mortgage via a property.
            </div>
          )}

          <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-slate-700/30">
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Total Liabilities</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(totalLiabilities)}</span>
          </div>
        </div>
      </div>

    </div>
  )
}
