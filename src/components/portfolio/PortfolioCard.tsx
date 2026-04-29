'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatPercent, gainClass } from '@/lib/formatters'
import { usePortfolio } from '@/hooks/usePortfolio'

interface PortfolioCardProps {
  id: string
  name: string
  description: string | null
  currency: string
  transactionCount: number
}

export function PortfolioCard({
  id,
  name,
  description,
  currency,
  transactionCount,
}: PortfolioCardProps) {
  const { performance, isLoading } = usePortfolio(id)

  return (
    <Link href={`/portfolios/${id}`}>
      <Card className="hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer h-full">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">{name}</h3>
            {description && (
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            )}
          </div>
          <Badge variant="blue">{currency}</Badge>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-gray-200 rounded w-32" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        ) : performance ? (
          <div className="space-y-2">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(performance.currentMarketValue, currency)}
              </p>
              <p className={`text-sm font-medium ${gainClass(performance.totalReturn)}`}>
                {formatCurrency(performance.totalReturn, currency, true)}{' '}
                <span className="text-gray-500">({formatPercent(performance.totalReturnPct)})</span>
              </p>
            </div>
            <div className="flex gap-4 text-xs text-gray-500 pt-1 border-t border-gray-100">
              <span>{performance.holdings.length} holdings</span>
              <span>{transactionCount} transactions</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No transactions yet</p>
        )}
      </Card>
    </Link>
  )
}
