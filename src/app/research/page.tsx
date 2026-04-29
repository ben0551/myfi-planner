'use client'

import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { MarketIndexLink } from '@/components/research/MarketIndexLink'
import { StockSearch } from '@/components/research/StockSearch'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Portfolio {
  id: string
  name: string
  transactions: { ticker: string }[]
}

export default function ResearchPage() {
  const router = useRouter()
  const { data: portfolios = [] } = useSWR<Portfolio[]>('/api/portfolios', fetcher)

  const allTickers = [
    ...new Set(
      portfolios.flatMap((p: Portfolio) =>
        (p.transactions ?? []).map((t: { ticker: string }) => t.ticker)
      )
    ),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Research</h1>
        <p className="text-sm text-gray-500 mt-1">
          Analyst ratings, financials, and ASX announcements for any stock
        </p>
      </div>

      <Card>
        <StockSearch />
      </Card>

      {allTickers.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Your Holdings</h2>
          <div className="flex flex-wrap gap-2">
            {allTickers.map((ticker) => (
              <div key={ticker} className="flex items-center rounded-lg bg-white border border-gray-200 overflow-hidden hover:border-indigo-300 transition-colors">
                <button
                  onClick={() => router.push(`/research/${ticker}`)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors"
                >
                  {ticker}
                </button>
                <MarketIndexLink
                  ticker={ticker}
                  className="px-2 py-1.5 text-xs text-gray-400 hover:text-indigo-500 border-l border-gray-200 transition-colors"
                >
                  ↗
                </MarketIndexLink>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
