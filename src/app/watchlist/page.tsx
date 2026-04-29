import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { WatchlistDashboard } from '@/components/watchlist/WatchlistDashboard'

export const dynamic = 'force-dynamic'

export default async function WatchlistPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Watchlist</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Track tickers with live prices and optional target price alerts
        </p>
      </div>
      <WatchlistDashboard />
    </div>
  )
}
