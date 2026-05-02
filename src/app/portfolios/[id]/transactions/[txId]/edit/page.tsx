import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string; txId: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id, txId } = await params

  const tx = await prisma.transaction.findUnique({
    where: { id: txId },
    include: { portfolio: { select: { userId: true } } },
  })

  if (!tx || tx.portfolio.userId !== session.user.id || tx.portfolioId !== id) {
    notFound()
  }

  const initialValues = {
    type: tx.type,
    ticker: tx.ticker,
    date: new Date(tx.date).toISOString().split('T')[0],
    quantity: tx.type === 'DIVIDEND' ? '' : tx.quantity.toString(),
    price: tx.type === 'DIVIDEND' ? '' : tx.price.toString(),
    fees: tx.fees.toString(),
    amount: tx.amount?.toString() ?? '',
    frankingCredit: tx.frankingCredit?.toString() ?? '0',
    notes: tx.notes ?? '',
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Link
          href={`/portfolios/${id}/transactions`}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← Transactions
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Edit Transaction</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tx.type} · {tx.ticker} · {new Date(tx.date).toLocaleDateString('en-AU')}
        </p>
      </div>

      <Card>
        <TransactionForm
          portfolioId={id}
          transactionId={txId}
          initialValues={initialValues}
        />
      </Card>
    </div>
  )
}
