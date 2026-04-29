import { formatCurrency } from '@/lib/formatters'
import type { Holding } from '@/lib/types'

interface DividendsSectionProps {
  holdings: Holding[]
  total: number
  currency: string
}

export function DividendsSection({ holdings, total, currency }: DividendsSectionProps) {
  const withDividends = holdings
    .filter((h) => h.dividendsReceived > 0)
    .sort((a, b) => b.dividendsReceived - a.dividendsReceived)

  if (total === 0) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">No dividends recorded</p>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-gray-500">Total received</span>
        <span className="text-lg font-bold text-green-600">
          {formatCurrency(total, currency)}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="pb-2 font-medium">Ticker</th>
            <th className="pb-2 font-medium text-right">Received</th>
            <th className="pb-2 font-medium text-right">Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {withDividends.map((h) => (
            <tr key={h.ticker}>
              <td className="py-2 font-medium text-gray-900">{h.ticker}</td>
              <td className="py-2 text-right text-gray-700">
                {formatCurrency(h.dividendsReceived, currency)}
              </td>
              <td className="py-2 text-right text-gray-500">
                {`${((h.dividendsReceived / total) * 100).toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
