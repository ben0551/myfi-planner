interface AnalystCounts {
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
}

interface AnalystPanelProps {
  counts: AnalystCounts
  recommendationMean: number | null
  recommendationKey: string | null
}

function ratingLabel(mean: number | null): string {
  if (mean === null) return 'N/A'
  if (mean <= 1.5) return 'Strong Buy'
  if (mean <= 2.5) return 'Buy'
  if (mean <= 3.5) return 'Hold'
  if (mean <= 4.5) return 'Sell'
  return 'Strong Sell'
}

function ratingColor(mean: number | null): string {
  if (mean === null) return 'text-gray-500'
  if (mean <= 1.5) return 'text-green-700'
  if (mean <= 2.5) return 'text-green-600'
  if (mean <= 3.5) return 'text-yellow-600'
  if (mean <= 4.5) return 'text-red-500'
  return 'text-red-700'
}

export function AnalystPanel({ counts, recommendationMean, recommendationKey }: AnalystPanelProps) {
  const total = counts.strongBuy + counts.buy + counts.hold + counts.sell + counts.strongSell

  if (total === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        No analyst recommendations available
      </div>
    )
  }

  const bars = [
    { label: 'Strong Buy', count: counts.strongBuy, color: 'bg-green-600' },
    { label: 'Buy', count: counts.buy, color: 'bg-green-400' },
    { label: 'Hold', count: counts.hold, color: 'bg-yellow-400' },
    { label: 'Sell', count: counts.sell, color: 'bg-red-400' },
    { label: 'Strong Sell', count: counts.strongSell, color: 'bg-red-600' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Consensus</p>
          <p className={`text-xl font-bold ${ratingColor(recommendationMean)}`}>
            {ratingLabel(recommendationMean)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{total} analysts</p>
          {recommendationMean && (
            <p className="text-sm text-gray-600">Score: {recommendationMean.toFixed(1)} / 5</p>
          )}
        </div>
      </div>

      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-3">
        {bars.map((b) => (
          <div
            key={b.label}
            className={`${b.color} transition-all`}
            style={{ width: total > 0 ? `${(b.count / total) * 100}%` : '0%' }}
            title={`${b.label}: ${b.count}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${b.color}`} />
            <span className="text-gray-600">{b.label}</span>
            <span className="font-medium text-gray-900">{b.count}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">Source: Yahoo Finance</p>
    </div>
  )
}
