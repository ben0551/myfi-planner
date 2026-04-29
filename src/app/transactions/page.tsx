import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { TransactionSearch } from '@/components/transactions/TransactionSearch'

export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Transactions</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Search and filter across all your portfolios
        </p>
      </div>
      <TransactionSearch />
    </div>
  )
}
