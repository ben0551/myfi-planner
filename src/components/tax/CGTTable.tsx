'use client'

import { formatCurrency, formatDate, formatNumber, gainClass } from '@/lib/formatters'
import { Badge } from '@/components/ui/Badge'
import type { CGTEvent } from '@/lib/tax'

interface CGTTableProps {
  events: CGTEvent[]
  currency: string
}

export function CGTTable({ events, currency }: CGTTableProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-6 text-center">
        No disposal events in this financial year.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="pb-3 pr-4 font-medium">Ticker</th>
            <th className="pb-3 pr-4 font-medium">Sell Date</th>
            <th className="pb-3 pr-4 font-medium text-right">Qty</th>
            <th className="pb-3 pr-4 font-medium text-right">Proceeds</th>
            <th className="pb-3 pr-4 font-medium text-right">Cost Base</th>
            <th className="pb-3 pr-4 font-medium text-right">Gross Gain</th>
            <th className="pb-3 pr-4 font-medium">Acquired</th>
            <th className="pb-3 pr-4 font-medium text-right">Held</th>
            <th className="pb-3 font-medium text-right">Assessable</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {events.map((e) => (
            <tr key={e.sellTxId} className="hover:bg-gray-50">
              <td className="py-3 pr-4 font-semibold text-gray-900">{e.ticker}</td>
              <td className="py-3 pr-4 text-gray-600">{formatDate(e.sellDate, 'short')}</td>
              <td className="py-3 pr-4 text-right text-gray-700">{formatNumber(e.qty, 0)}</td>
              <td className="py-3 pr-4 text-right text-gray-700">
                {formatCurrency(e.proceeds, currency)}
              </td>
              <td className="py-3 pr-4 text-right text-gray-700">
                {formatCurrency(e.costBase, currency)}
              </td>
              <td className={`py-3 pr-4 text-right font-medium ${gainClass(e.grossGain)}`}>
                {formatCurrency(e.grossGain, currency)}
              </td>
              <td className="py-3 pr-4 text-gray-600">
                {e.acquisitionDate ? formatDate(e.acquisitionDate, 'short') : '—'}
              </td>
              <td className="py-3 pr-4 text-right text-gray-500">
                {e.holdingDays}d
                {e.discountEligible && (
                  <span className="ml-1 inline-block rounded bg-green-100 px-1 py-0.5 text-xs text-green-700">
                    50%
                  </span>
                )}
              </td>
              <td className={`py-3 text-right font-medium ${gainClass(e.assessableGain)}`}>
                {formatCurrency(e.assessableGain, currency)}
                {e.discountEligible && (
                  <Badge variant="green" className="ml-1.5 text-xs">Discounted</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
