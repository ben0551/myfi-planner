import { Decimal } from '@prisma/client/runtime/library'

export type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND'

export interface Holding {
  ticker: string
  quantity: number
  avgCost: number
  totalCostBasis: number
  currentPrice: number | null
  currentValue: number | null
  unrealisedGain: number | null
  unrealisedGainPct: number | null
  dividendsReceived: number
}

export interface PortfolioPerformance {
  portfolioId: string
  portfolioName: string
  currency: string
  holdings: Holding[]
  totalInvested: number
  currentMarketValue: number
  unrealisedGain: number
  unrealisedGainPct: number
  realisedGain: number
  dividendsReceived: number
  totalReturn: number
  totalReturnPct: number
}

export interface QuoteResult {
  ticker: string
  price: number
  currency: string
  change: number | null
  changePct: number | null
  marketTime: Date
  source: 'ASX' | 'YAHOO'
  companyName?: string | null
  fiftyTwoWeekHigh?: number | null
  fiftyTwoWeekLow?: number | null
}

export interface ResearchSummary {
  ticker: string
  companyName: string
  currentPrice: number | null
  change: number | null
  changePct: number | null
  marketCap: number | null
  peRatio: number | null
  forwardPE: number | null
  eps: number | null
  dividendYield: number | null
  beta: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  recommendationMean: number | null
  recommendationKey: string | null
  analystCounts: {
    strongBuy: number
    buy: number
    hold: number
    sell: number
    strongSell: number
  }
  announcements: {
    asxId: string
    title: string
    url: string
    marketSensitive: boolean
    releasedAt: Date
    category: string | null
  }[]
}

export function toNumber(val: Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return val
  return val.toNumber()
}
