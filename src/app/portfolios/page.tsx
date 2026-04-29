import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PortfolioCard } from '@/components/portfolio/PortfolioCard'
import { Button } from '@/components/ui/Button'

export const dynamic = 'force-dynamic'

export default async function PortfoliosPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { transactions: true } } },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Portfolios</h1>
        <Link href="/portfolios/new">
          <Button>+ New Portfolio</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {portfolios.map((p) => (
          <PortfolioCard
            key={p.id}
            id={p.id}
            name={p.name}
            description={p.description}
            currency={p.currency}
            transactionCount={p._count.transactions}
          />
        ))}
      </div>
    </div>
  )
}
