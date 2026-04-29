'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters'

interface Transaction {
  id: string
  type: string
  ticker: string
  date: string
  quantity: string | number
  price: string | number
  fees: string | number
  amount: string | number | null
  notes: string | null
}

interface TransactionTableProps {
  transactions: Transaction[]
  currency: string
  portfolioId: string
  onDelete: (id: string) => void
}

const typeBadge: Record<string, 'blue' | 'red' | 'green'> = {
  BUY: 'blue',
  SELL: 'red',
  DIVIDEND: 'green',
}

export function TransactionTable({
  transactions,
  currency,
  portfolioId,
  onDelete,
}: TransactionTableProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No transactions found.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="pb-3 pr-4 font-medium">Date</th>
            <th className="pb-3 pr-4 font-medium">Type</th>
            <th className="pb-3 pr-4 font-medium">Ticker</th>
            <th className="pb-3 pr-4 font-medium text-right">Qty</th>
            <th className="pb-3 pr-4 font-medium text-right">Price</th>
            <th className="pb-3 pr-4 font-medium text-right">Fees</th>
            <th className="pb-3 pr-4 font-medium text-right">Total</th>
            <th className="pb-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((tx) => {
            const qty = typeof tx.quantity === 'string' ? parseFloat(tx.quantity) : tx.quantity
            const price = typeof tx.price === 'string' ? parseFloat(tx.price) : tx.price
            const fees = typeof tx.fees === 'string' ? parseFloat(tx.fees) : tx.fees
            const amount = tx.amount
              ? typeof tx.amount === 'string'
                ? parseFloat(tx.amount)
                : tx.amount
              : null
            const total =
              tx.type === 'DIVIDEND'
                ? amount
                : tx.type === 'BUY'
                ? qty * price + fees
                : qty * price - fees

            return (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="py-3 pr-4 text-gray-600">
                  {formatDate(tx.date, 'short')}
                </td>
                <td className="py-3 pr-4">
                  <Badge variant={typeBadge[tx.type] ?? 'gray'}>{tx.type}</Badge>
                </td>
                <td className="py-3 pr-4 font-semibold text-gray-900">{tx.ticker}</td>
                <td className="py-3 pr-4 text-right text-gray-700">
                  {tx.type === 'DIVIDEND' ? '—' : formatNumber(qty, 0)}
                </td>
                <td className="py-3 pr-4 text-right text-gray-700">
                  {tx.type === 'DIVIDEND' ? '—' : formatCurrency(price, currency)}
                </td>
                <td className="py-3 pr-4 text-right text-gray-500">
                  {fees > 0 ? formatCurrency(fees, currency) : '—'}
                </td>
                <td className="py-3 pr-4 text-right font-medium text-gray-900">
                  {formatCurrency(total ?? 0, currency)}
                </td>
                <td className="py-3 text-right">
                  {confirmDelete === tx.id ? (
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-gray-500">Delete?</span>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          onDelete(tx.id)
                          setConfirmDelete(null)
                        }}
                      >
                        Yes
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/portfolios/${portfolioId}/transactions/${tx.id}/edit`}
                      >
                        <Button size="sm" variant="ghost">Edit</Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(tx.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
