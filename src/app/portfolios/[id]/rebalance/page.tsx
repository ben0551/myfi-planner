import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RebalanceTool } from '@/components/portfolio/RebalanceTool'

export const dynamic = 'force-dynamic'

export default async function RebalancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params

  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
    select: { id: true, name: true, currency: true },
  })
  if (!portfolio) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/portfolios/${id}`}
          className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
        >
          ← {portfolio.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Rebalance</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Set target allocations and see suggested trades to get back on track
        </p>
      </div>

      <div className="rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-xs text-blue-700 dark:text-blue-300">
        Enter target percentages for each holding. Optionally add new cash to deploy and enable buy-only
        mode to avoid selling. Targets are saved and persist between sessions.
      </div>

      <RebalanceTool portfolioId={id} currency={portfolio.currency} />
    </div>
  )
}
