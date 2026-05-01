import { formatCurrency, formatNumber } from '@/lib/formatters'

interface KeyStatsProps {
  marketCap: number | null
  peRatio: number | null
  forwardPE: number | null
  eps: number | null
  dividendYield: number | null
  dividendAmount: number | null
  frankingPct: number | null
  beta: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  currentPrice: number | null
  sector: string | null
  industry: string | null
}

function Stat({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-800 last:border-0 gap-4">
      <span className="text-sm text-gray-500 dark:text-slate-400 shrink-0">{label}</span>
      {children ?? <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{value}</span>}
    </div>
  )
}

export function KeyStats({
  marketCap,
  peRatio,
  forwardPE,
  eps,
  dividendYield,
  dividendAmount,
  frankingPct,
  beta,
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
  currentPrice,
  sector,
  industry,
}: KeyStatsProps) {
  const rangeWidth =
    fiftyTwoWeekHigh != null &&
    fiftyTwoWeekLow != null &&
    currentPrice != null &&
    fiftyTwoWeekHigh > fiftyTwoWeekLow
      ? ((currentPrice - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100
      : null

  return (
    <div>
      {marketCap != null && (
        <Stat label="Market Cap" value={formatCurrency(marketCap, 'AUD', true)} />
      )}
      {peRatio != null && (
        <Stat label="P/E Ratio" value={formatNumber(peRatio, 2)} />
      )}
      {forwardPE != null && (
        <Stat label="Forward P/E" value={formatNumber(forwardPE, 2)} />
      )}
      {eps != null && (
        <Stat label="EPS" value={formatCurrency(eps)} />
      )}
      {dividendYield != null && (
        <Stat
          label="Dividend Yield"
          value={`${dividendYield.toFixed(2)}%${frankingPct != null ? ` (${frankingPct}% franked)` : ''}`}
        />
      )}
      {dividendAmount != null && (
        <Stat label="Annual Dividend" value={formatCurrency(dividendAmount)} />
      )}
      {beta != null && (
        <Stat label="Beta" value={formatNumber(beta, 2)} />
      )}
      {fiftyTwoWeekHigh != null && fiftyTwoWeekLow != null && (
        <Stat label="52-Week Range">
          <div className="flex flex-col items-end gap-1 min-w-0">
            <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
              {formatCurrency(fiftyTwoWeekLow)} – {formatCurrency(fiftyTwoWeekHigh)}
            </span>
            {rangeWidth != null && (
              <div className="w-24 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, rangeWidth))}%` }}
                />
              </div>
            )}
          </div>
        </Stat>
      )}
      {sector && (
        <Stat label="Sector" value={sector} />
      )}
      {industry && (
        <Stat label="Industry" value={industry} />
      )}
    </div>
  )
}
