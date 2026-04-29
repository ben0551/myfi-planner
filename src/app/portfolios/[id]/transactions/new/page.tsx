import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { TransactionForm } from '@/components/transactions/TransactionForm'

export const dynamic = 'force-dynamic'

export default async function NewTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({ where: { id, userId: session.user.id } })
  if (!portfolio) notFound()

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href={`/portfolios/${id}`} className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Back to {portfolio.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Add Transaction</h1>
      </div>
      <Card>
        <TransactionForm portfolioId={id} />
      </Card>
    </div>
  )
}
