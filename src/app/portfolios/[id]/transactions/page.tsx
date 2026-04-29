'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TransactionTable } from '@/components/transactions/TransactionTable'
import { useTransactions } from '@/hooks/useTransactions'

export default function TransactionsPage() {
  const params = useParams()
  const id = params.id as string
  const { transactions, isLoading, deleteTransaction } = useTransactions(id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <Link href={`/portfolios/${id}`} className="text-sm text-indigo-600 hover:text-indigo-800">
            ← Back to portfolio
          </Link>
        </div>
        <div className="flex gap-2">
          <Link href={`/portfolios/${id}/transactions/import`}>
            <Button variant="secondary">Import CSV</Button>
          </Link>
          <Link href={`/portfolios/${id}/transactions/new`}>
            <Button>+ Add Transaction</Button>
          </Link>
        </div>
      </div>

      <Card padding={false}>
        <div className="p-6">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded" />
              ))}
            </div>
          ) : (
            <TransactionTable
              transactions={transactions}
              currency="AUD"
              portfolioId={id}
              onDelete={deleteTransaction}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
