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
import { getFmpData } from '@/lib/fmp'
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

  const [priceMap, fundamentals, profile, fmp] = await Promise.all([
    getCachedAsxQuotes([upper]),
    getYfFundamentals(upper),
    getYfProfile(upper),
    getFmpData(upper),
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

      {/* FMP Company overview */}
      {fmp.profile?.description && (
        <Card>
          <div className="flex items-start justify-between mb-3">
            <h2 className="font-semibold text-gray-900">About {fmp.profile.companyName || upper}</h2>
            {fmp.profile.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fmp.profile.image} alt="" className="h-8 w-8 object-contain rounded" />
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {fmp.profile.sector && <span className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">{fmp.profile.sector}</span>}
            {fmp.profile.industry && <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{fmp.profile.industry}</span>}
            {fmp.profile.fullTimeEmployees && <span className="text-xs text-gray-400">{Number(fmp.profile.fullTimeEmployees).toLocaleString()} employees</span>}
            {fmp.profile.ipoDate && <span className="text-xs text-gray-400">Listed {fmp.profile.ipoDate}</span>}
          </div>
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{fmp.profile.description}</p>
          {fmp.profile.website && (
            <a href={fmp.profile.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-indigo-600 hover:underline">
              {fmp.profile.website} ↗
            </a>
          )}
        </Card>
      )}

      {/* FMP Financial ratios */}
      {fmp.ratios && (
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">Financial Ratios <span className="text-xs font-normal text-gray-400 ml-1">TTM — via FMP</span></h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: 'P/E Ratio', value: fmp.ratios.peRatioTTM?.toFixed(1) },
              { label: 'P/B Ratio', value: fmp.ratios.pbRatioTTM?.toFixed(2) },
              { label: 'P/S Ratio', value: fmp.ratios.priceToSalesRatioTTM?.toFixed(2) },
              { label: 'Dividend Yield', value: fmp.ratios.dividendYielTTM != null ? `${(fmp.ratios.dividendYielTTM * 100).toFixed(2)}%` : null },
              { label: 'EPS (TTM)', value: fmp.ratios.epsBasicTTM != null ? `$${fmp.ratios.epsBasicTTM.toFixed(3)}` : null },
              { label: 'ROE', value: fmp.ratios.returnOnEquityTTM != null ? `${(fmp.ratios.returnOnEquityTTM * 100).toFixed(1)}%` : null },
              { label: 'ROA', value: fmp.ratios.returnOnAssetsTTM != null ? `${(fmp.ratios.returnOnAssetsTTM * 100).toFixed(1)}%` : null },
              { label: 'Net Margin', value: fmp.ratios.netProfitMarginTTM != null ? `${(fmp.ratios.netProfitMarginTTM * 100).toFixed(1)}%` : null },
              { label: 'Debt / Equity', value: fmp.ratios.debtEquityRatioTTM?.toFixed(2) },
              { label: 'Current Ratio', value: fmp.ratios.currentRatioTTM?.toFixed(2) },
              { label: 'FCF / Share', value: fmp.ratios.freeCashFlowPerShareTTM != null ? `$${fmp.ratios.freeCashFlowPerShareTTM.toFixed(3)}` : null },
            ].filter((s) => s.value != null).map((stat) => (
              <div key={stat.label} className="space-y-0.5">
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-sm font-semibold text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* FMP Income statement history */}
      {fmp.income.length > 0 && (
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">Annual Financials <span className="text-xs font-normal text-gray-400 ml-1">via FMP</span></h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 text-left">
                  <th className="pb-2 font-medium">Year</th>
                  <th className="pb-2 font-medium text-right">Revenue</th>
                  <th className="pb-2 font-medium text-right">Net Income</th>
                  <th className="pb-2 font-medium text-right">EBITDA</th>
                  <th className="pb-2 font-medium text-right">Gross Margin</th>
                  <th className="pb-2 font-medium text-right">EPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fmp.income.map((row) => (
                  <tr key={row.date}>
                    <td className="py-2 text-gray-700">{row.date.slice(0, 4)}</td>
                    <td className="py-2 text-right text-gray-900 tabular-nums">{row.revenue != null ? fmtMarketCap(row.revenue) : '—'}</td>
                    <td className={`py-2 text-right tabular-nums font-medium ${row.netIncome != null && row.netIncome < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {row.netIncome != null ? fmtMarketCap(row.netIncome) : '—'}
                    </td>
                    <td className="py-2 text-right text-gray-600 tabular-nums">{row.ebitda != null ? fmtMarketCap(row.ebitda) : '—'}</td>
                    <td className="py-2 text-right text-gray-600 tabular-nums">{row.grossProfitRatio != null ? `${(row.grossProfitRatio * 100).toFixed(1)}%` : '—'}</td>
                    <td className="py-2 text-right text-gray-600 tabular-nums">{row.eps != null ? `$${row.eps.toFixed(3)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* FMP News */}
      {fmp.news.length > 0 && (
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">Latest News <span className="text-xs font-normal text-gray-400 ml-1">via FMP</span></h2>
          <div className="space-y-4">
            {fmp.news.map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 group"
              >
                {article.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={article.image} alt="" className="w-16 h-12 object-cover rounded flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2">{article.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{article.site} · {new Date(article.publishedDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </a>
            ))}
          </div>
        </Card>
      )}

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
