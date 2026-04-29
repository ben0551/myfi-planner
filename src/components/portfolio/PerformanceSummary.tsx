import { Card } from '@/components/ui/Card'
import { formatCurrency, formatPercent, gainClass } from '@/lib/formatters'
import type { PortfolioPerformance } from '@/lib/types'

interface PerformanceSummaryProps {
  performance: PortfolioPerformance
}

export function PerformanceSummary({ performance }: PerformanceSummaryProps) {
  const { currency } = performance

  const stats = [
    {
      label: 'Market Value',
      value: formatCurrency(performance.currentMarketValue, currency),
      sub: null,
      highlight: false,
    },
    {
      label: 'Total Invested',
      value: formatCurrency(performance.totalInvested, currency),
      sub: null,
      highlight: false,
    },
    {
      label: 'Unrealised Gain',
      value: formatCurrency(performance.unrealisedGain, currency),
      sub: formatPercent(performance.unrealisedGainPct),
      highlight: true,
      gain: performance.unrealisedGain,
    },
    {
      label: 'Realised Gain',
      value: formatCurrency(performance.realisedGain, currency),
      sub: null,
      highlight: true,
      gain: performance.realisedGain,
    },
    {
      label: 'Dividends Received',
      value: formatCurrency(performance.dividendsReceived, currency),
      sub: null,
      highlight: false,
    },
    {
      label: 'Total Return',
      value: formatCurrency(performance.totalReturn, currency),
      sub: formatPercent(performance.totalReturnPct),
      highlight: true,
      gain: performance.totalReturn,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="text-center">
          <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
          <p
            className={`text-base font-bold ${
              stat.highlight && stat.gain !== undefined
                ? gainClass(stat.gain)
                : 'text-gray-900'
            }`}
          >
            {stat.value}
          </p>
          {stat.sub && (
            <p
              className={`text-xs mt-0.5 ${
                stat.highlight && stat.gain !== undefined
                  ? gainClass(stat.gain)
                  : 'text-gray-500'
              }`}
            >
              {stat.sub}
            </p>
          )}
        </Card>
      ))}
    </div>
  )
}
