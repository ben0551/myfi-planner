import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AnalysisDashboard } from '@/components/portfolio/AnalysisDashboard'

export const dynamic = 'force-dynamic'

export default async function AnalysisPage({
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
        <Link href={`/portfolios/${id}`} className="text-sm text-indigo-600 hover:text-indigo-800">
          ← {portfolio.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Portfolio Analysis</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Sector, region, risk composition and benchmark comparison
        </p>
      </div>

      <AnalysisDashboard portfolioId={id} currency={portfolio.currency} />
    </div>
  )
}
