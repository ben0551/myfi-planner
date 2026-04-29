import { formatCurrency, formatNumber, formatPercent } from '@/lib/formatters'

interface KeyStatsProps {
  marketCap: number | null
  peRatio: number | null
  forwardPE: number | null
  eps: number | null
  dividendYield: number | null
  beta: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}

export function KeyStats({
  marketCap,
  peRatio,
  forwardPE,
  eps,
  dividendYield,
  beta,
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
}: KeyStatsProps) {
  return (
    <div>
      <Stat
        label="Market Cap"
        value={marketCap ? formatCurrency(marketCap, 'AUD', true) : '—'}
      />
      <Stat label="P/E Ratio" value={peRatio ? formatNumber(peRatio, 2) : '—'} />
      <Stat label="Forward P/E" value={forwardPE ? formatNumber(forwardPE, 2) : '—'} />
      <Stat label="EPS" value={eps ? formatCurrency(eps) : '—'} />
      <Stat
        label="Dividend Yield"
        value={dividendYield ? `${dividendYield.toFixed(2)}%` : '—'}
      />
      <Stat label="Beta" value={beta ? formatNumber(beta, 2) : '—'} />
      <Stat
        label="52-Week High"
        value={fiftyTwoWeekHigh ? formatCurrency(fiftyTwoWeekHigh) : '—'}
      />
      <Stat
        label="52-Week Low"
        value={fiftyTwoWeekLow ? formatCurrency(fiftyTwoWeekLow) : '—'}
      />
    </div>
  )
}
