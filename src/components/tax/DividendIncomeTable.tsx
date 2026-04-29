'use client'

import { formatCurrency } from '@/lib/formatters'
import type { DividendByTicker, DividendEvent } from '@/lib/tax'

interface DividendIncomeTableProps {
  events: DividendEvent[]
  byTicker: DividendByTicker[]
  currency: string
}

export function DividendIncomeTable({ events, byTicker, currency }: DividendIncomeTableProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-6 text-center">
        No dividend income in this financial year.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="pb-3 pr-4 font-medium">Ticker</th>
            <th className="pb-3 pr-4 font-medium text-right">Cash Dividends</th>
            <th className="pb-3 pr-4 font-medium text-right">Franking Credits</th>
            <th className="pb-3 font-medium text-right">Grossed-Up</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {byTicker.map((t) => (
            <tr key={t.ticker} className="hover:bg-gray-50">
              <td className="py-3 pr-4 font-semibold text-gray-900">{t.ticker}</td>
              <td className="py-3 pr-4 text-right text-gray-700">
                {formatCurrency(t.cashTotal, currency)}
              </td>
              <td className="py-3 pr-4 text-right text-indigo-600">
                {t.frankingCreditTotal > 0
                  ? formatCurrency(t.frankingCreditTotal, currency)
                  : <span className="text-gray-400">—</span>}
              </td>
              <td className="py-3 text-right font-medium text-gray-900">
                {formatCurrency(t.grossedUpTotal, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
