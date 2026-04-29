import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { TickerClassificationEditor } from '@/components/portfolio/TickerClassificationEditor'

export const dynamic = 'force-dynamic'

export default async function TickerClassificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>
  searchParams: Promise<{ back?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { ticker } = await params
  const { back } = await searchParams
  const upper = ticker.toUpperCase()

  // Get company name from price cache if available
  const cached = await prisma.priceCache.findUnique({
    where: { ticker: upper },
    select: { companyName: true },
  })

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        {back && (
          <a href={back} className="text-sm text-indigo-600 hover:text-indigo-800">
            ← Back
          </a>
        )}
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-gray-900">{upper}</h1>
          {cached?.companyName && (
            <p className="text-sm text-gray-500 mt-0.5">{cached.companyName}</p>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">Classification</p>
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        Manual classifications take priority over auto-detected Yahoo Finance data in portfolio analysis.
        Sector weights in <strong>Industries</strong> and geographic weights in <strong>Regions</strong>
        are used for look-through in the Analysis charts.
      </div>

      <Card>
        <TickerClassificationEditor ticker={upper} companyName={cached?.companyName} />
      </Card>
    </div>
  )
}
