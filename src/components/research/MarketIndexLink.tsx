'use client'

interface Props {
  ticker: string
  className?: string
  children?: React.ReactNode
}

export function MarketIndexLink({ ticker, className, children }: Props) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Fire-and-forget — archive the data in the background
    // Don't await or block navigation
    void fetch(`/api/research/marketindex/${ticker}`, { method: 'POST' })
      .catch(() => {/* silent fail */})

    // Let the browser open the new tab normally (default anchor behaviour)
    // We don't call e.preventDefault()
    void e  // suppress lint warning
  }

  return (
    <a
      href={`https://www.marketindex.com.au/asx/${ticker.toLowerCase()}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children ?? 'MarketIndex ↗'}
    </a>
  )
}
