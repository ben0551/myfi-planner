import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AnalystPanel } from '@/components/research/AnalystPanel'
import { KeyStats } from '@/components/research/KeyStats'
import { AnnouncementsFeed } from '@/components/research/AnnouncementsFeed'
import { PriceChart } from '@/components/research/PriceChart'
import { MarketIndexLink } from '@/components/research/MarketIndexLink'
import { MarketIndexPanel } from '@/components/research/MarketIndexPanel'
import { formatCurrency, gainClass, formatPercent } from '@/lib/formatters'
import { getCachedAsxQuotes, syncAnnouncements } from '@/lib/asx/cache'
import { getYfFundamentals, getYfProfile } from '@/lib/yahoo'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

function fmtMarketCap(v: number | null): string | null {
  if (v == null) return null
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

export const dynamic = 'force-dynamic'

export default async function ResearchTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>
}) {
  const { ticker } = await params
  const upper = ticker.toUpperCase()

  const [priceMap, fundamentals, profile] = await Promise.all([
    getCachedAsxQuotes([upper]),
    getYfFundamentals(upper),
    getYfProfile(upper),
    syncAnnouncements(upper),
  ])

  const quote = priceMap.get(upper)
  const announcements = await prisma.announcement.findMany({
    where: { ticker: upper },
    orderBy: { releasedAt: 'desc' },
    take: 20,
  })

  // Archive Yahoo Finance data to DB on every visit (fire and forget)
  void prisma.marketIndexSnapshot.upsert({
    where: { ticker: upper },
    update: {
      fetchedAt: new Date(),
      companyName: quote?.companyName ?? null,
      price: quote?.price ?? null,
      change: quote?.change ?? null,
      changePct: quote?.changePct ?? null,
      high52Week: quote?.fiftyTwoWeekHigh ?? null,
      low52Week: quote?.fiftyTwoWeekLow ?? null,
      marketCap: fmtMarketCap(fundamentals?.marketCap ?? null),
      peRatio: fundamentals?.trailingPE ?? null,
      eps: fundamentals?.trailingEps ?? null,
      dividendYield: fundamentals?.dividendYield ?? null,
      sector: profile?.sector ?? null,
      industry: profile?.industry ?? null,
    },
    create: {
      ticker: upper,
      fetchedAt: new Date(),
      companyName: quote?.companyName ?? null,
      price: quote?.price ?? null,
      change: quote?.change ?? null,
      changePct: quote?.changePct ?? null,
      high52Week: quote?.fiftyTwoWeekHigh ?? null,
      low52Week: quote?.fiftyTwoWeekLow ?? null,
      marketCap: fmtMarketCap(fundamentals?.marketCap ?? null),
      peRatio: fundamentals?.trailingPE ?? null,
      eps: fundamentals?.trailingEps ?? null,
      dividendYield: fundamentals?.dividendYield ?? null,
      sector: profile?.sector ?? null,
      industry: profile?.industry ?? null,
    },
  }).catch((err) => console.error('[research] snapshot save failed:', err))

  const currentPrice = quote?.price ?? null
  const changePct = quote?.changePct ?? null
  const companyName = quote?.companyName ?? upper

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/research" className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Research
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{upper}</h1>
              {companyName !== upper && (
                <span className="text-lg text-gray-500">{companyName}</span>
              )}
            </div>
            {currentPrice != null ? (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-3xl font-bold text-gray-900">
                  {formatCurrency(currentPrice)}
                </span>
                {changePct !== null && (
                  <span className={`text-sm font-medium ${gainClass(changePct)}`}>
                    {formatPercent(changePct)} today
                  </span>
                )}
                <Badge variant="blue">ASX</Badge>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-1">Price unavailable</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <MarketIndexLink
              ticker={upper}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            />
            <Link
              href={`https://www.asx.com.au/markets/company/${upper.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ASX ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Price chart */}
      <Card>
        <h2 className="font-semibold text-gray-900 mb-4">200-Day Price History</h2>
        <PriceChart ticker={upper} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analyst */}
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">Analyst Recommendations</h2>
          <AnalystPanel
            counts={{ strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 }}
            recommendationMean={null}
            recommendationKey={null}
          />
        </Card>

        {/* Key Stats */}
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">Key Statistics</h2>
          <KeyStats
            marketCap={fundamentals?.marketCap ?? null}
            peRatio={fundamentals?.trailingPE ?? null}
            forwardPE={fundamentals?.forwardPE ?? null}
            eps={fundamentals?.trailingEps ?? null}
            dividendYield={fundamentals?.dividendYield ?? null}
            beta={fundamentals?.beta ?? null}
            fiftyTwoWeekHigh={quote?.fiftyTwoWeekHigh ?? null}
            fiftyTwoWeekLow={quote?.fiftyTwoWeekLow ?? null}
          />
        </Card>
      </div>

      {/* Archived fundamentals */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Saved Fundamentals</h2>
            <p className="text-xs text-gray-400 mt-0.5">Archived from Yahoo Finance on each visit</p>
          </div>
          <MarketIndexLink
            ticker={upper}
            className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
          >
            MarketIndex ↗
          </MarketIndexLink>
        </div>
        <MarketIndexPanel ticker={upper} />
      </Card>

      {/* Announcements */}
      <Card>
        <h2 className="font-semibold text-gray-900 mb-4">ASX Announcements</h2>
        <AnnouncementsFeed announcements={announcements.map((a) => ({
          asxId: a.asxId,
          title: a.title,
          url: a.url,
          marketSensitive: a.marketSensitive,
          releasedAt: a.releasedAt,
          category: a.category,
        }))} />
      </Card>
    </div>
  )
}
