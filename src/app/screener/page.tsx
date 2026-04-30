import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { StockScreener } from '@/components/research/StockScreener'

export const dynamic = 'force-dynamic'

export default async function ScreenerPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Screener</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Filter your holdings and watchlist by yield, P/E, sector, and more
        </p>
      </div>
      <StockScreener />
    </div>
  )
}
