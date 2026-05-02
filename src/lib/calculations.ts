import Decimal from 'decimal.js'
import type { Transaction } from '@prisma/client'
import type { Holding, PortfolioPerformance, QuoteResult } from './types'

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

interface HoldingState {
  quantity: Decimal
  totalCostBasis: Decimal
  avgCost: Decimal
  realisedGain: Decimal
  dividendsReceived: Decimal
}

export function buildHoldings(
  transactions: Transaction[],
  priceMap: Map<string, QuoteResult>
): Holding[] {
  const holdingMap = new Map<string, HoldingState>()

  // Sort by date ascending for correct avg cost calculation
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  for (const tx of sorted) {
    const ticker = tx.ticker.toUpperCase()
    if (!holdingMap.has(ticker)) {
      holdingMap.set(ticker, {
        quantity: new Decimal(0),
        totalCostBasis: new Decimal(0),
        avgCost: new Decimal(0),
        realisedGain: new Decimal(0),
        dividendsReceived: new Decimal(0),
      })
    }
    const h = holdingMap.get(ticker)!
    const qty = new Decimal(tx.quantity.toString())
    const price = new Decimal(tx.price.toString())
    const fees = new Decimal(tx.fees.toString())

    if (tx.type === 'BUY') {
      const cost = qty.times(price).plus(fees)
      const newQty = h.quantity.plus(qty)
      h.totalCostBasis = h.totalCostBasis.plus(cost)
      h.avgCost = newQty.gt(0)
        ? h.totalCostBasis.dividedBy(newQty)
        : new Decimal(0)
      h.quantity = newQty
    } else if (tx.type === 'SELL') {
      const proceeds = qty.times(price).minus(fees)
      const costOfSold = h.avgCost.times(qty)
      h.realisedGain = h.realisedGain.plus(proceeds.minus(costOfSold))
      const newQty = h.quantity.minus(qty)
      h.totalCostBasis = newQty.gt(0) ? h.avgCost.times(newQty) : new Decimal(0)
      h.quantity = newQty.lt(0) ? new Decimal(0) : newQty
    } else if (tx.type === 'DIVIDEND') {
      const amount = tx.amount ? new Decimal(tx.amount.toString()) : new Decimal(0)
      h.dividendsReceived = h.dividendsReceived.plus(amount)
    } else if (tx.type === 'DRP') {
      // Dividend Reinvestment Plan: new shares acquired at DRP price, funded by dividend
      const cost = qty.times(price)
      const newQty = h.quantity.plus(qty)
      h.totalCostBasis = h.totalCostBasis.plus(cost)
      h.avgCost = newQty.gt(0) ? h.totalCostBasis.dividedBy(newQty) : new Decimal(0)
      h.quantity = newQty
      // The reinvested dividend counts as dividend income
      const drpIncome = tx.amount ? new Decimal(tx.amount.toString()) : cost
      h.dividendsReceived = h.dividendsReceived.plus(drpIncome)
    }
  }

  const results: Holding[] = []
  for (const [ticker, h] of holdingMap) {
    const qty = h.quantity.toNumber()
    const avgCost = h.avgCost.toNumber()
    const totalCostBasis = h.totalCostBasis.toNumber()
    const quote = priceMap.get(ticker)
    const currentPrice = quote?.price ?? null
    const currentValue = currentPrice !== null ? qty * currentPrice : null
    const unrealisedGain = currentValue !== null ? currentValue - totalCostBasis : null
    const unrealisedGainPct =
      unrealisedGain !== null && totalCostBasis > 0
        ? (unrealisedGain / totalCostBasis) * 100
        : null

    results.push({
      ticker,
      quantity: qty,
      avgCost,
      totalCostBasis,
      currentPrice,
      currentValue,
      unrealisedGain,
      unrealisedGainPct,
      dividendsReceived: h.dividendsReceived.toNumber(),
    })
  }

  return results.filter((h) => h.quantity > 0.00001)
}

export function computePortfolioPerformance(
  portfolioId: string,
  portfolioName: string,
  currency: string,
  transactions: Transaction[],
  priceMap: Map<string, QuoteResult>
): PortfolioPerformance {
  const holdings = buildHoldings(transactions, priceMap)

  let totalInvested = new Decimal(0)
  let totalSellProceeds = new Decimal(0)
  let totalDividends = new Decimal(0)
  let totalRealisedGain = new Decimal(0)

  // Rebuild from scratch to get accurate totals
  const holdingMap = new Map<string, HoldingState>()
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  for (const tx of sorted) {
    const ticker = tx.ticker.toUpperCase()
    if (!holdingMap.has(ticker)) {
      holdingMap.set(ticker, {
        quantity: new Decimal(0),
        totalCostBasis: new Decimal(0),
        avgCost: new Decimal(0),
        realisedGain: new Decimal(0),
        dividendsReceived: new Decimal(0),
      })
    }
    const h = holdingMap.get(ticker)!
    const qty = new Decimal(tx.quantity.toString())
    const price = new Decimal(tx.price.toString())
    const fees = new Decimal(tx.fees.toString())

    if (tx.type === 'BUY') {
      const cost = qty.times(price).plus(fees)
      totalInvested = totalInvested.plus(cost)
      const newQty = h.quantity.plus(qty)
      h.totalCostBasis = h.totalCostBasis.plus(cost)
      h.avgCost = newQty.gt(0) ? h.totalCostBasis.dividedBy(newQty) : new Decimal(0)
      h.quantity = newQty
    } else if (tx.type === 'SELL') {
      const proceeds = qty.times(price).minus(fees)
      totalSellProceeds = totalSellProceeds.plus(proceeds)
      const costOfSold = h.avgCost.times(qty)
      const gain = proceeds.minus(costOfSold)
      totalRealisedGain = totalRealisedGain.plus(gain)
      h.realisedGain = h.realisedGain.plus(gain)
      const newQty = h.quantity.minus(qty)
      h.totalCostBasis = newQty.gt(0) ? h.avgCost.times(newQty) : new Decimal(0)
      h.quantity = newQty.lt(0) ? new Decimal(0) : newQty
    } else if (tx.type === 'DIVIDEND') {
      const amount = tx.amount ? new Decimal(tx.amount.toString()) : new Decimal(0)
      totalDividends = totalDividends.plus(amount)
    } else if (tx.type === 'DRP') {
      const cost = qty.times(price)
      totalInvested = totalInvested.plus(cost)
      const newQty = h.quantity.plus(qty)
      h.totalCostBasis = h.totalCostBasis.plus(cost)
      h.avgCost = newQty.gt(0) ? h.totalCostBasis.dividedBy(newQty) : new Decimal(0)
      h.quantity = newQty
      const drpIncome = tx.amount ? new Decimal(tx.amount.toString()) : cost
      totalDividends = totalDividends.plus(drpIncome)
    }
  }

  const currentMarketValue = holdings.reduce(
    (sum, h) => sum + (h.currentValue ?? 0),
    0
  )

  const invested = totalInvested.toNumber()
  const realisedGain = totalRealisedGain.toNumber()
  const dividends = totalDividends.toNumber()
  const unrealisedGain = currentMarketValue - (invested - totalSellProceeds.minus(totalRealisedGain).toNumber())

  // Total return = (current value + sell proceeds + dividends - total invested)
  const totalReturnAbs =
    currentMarketValue + totalSellProceeds.toNumber() + dividends - invested
  const totalReturnPct = invested > 0 ? (totalReturnAbs / invested) * 100 : 0

  const totalUnrealisedGain = holdings.reduce(
    (sum, h) => sum + (h.unrealisedGain ?? 0),
    0
  )
  const totalCostBasisOpen = holdings.reduce((sum, h) => sum + h.totalCostBasis, 0)
  const unrealisedGainPct =
    totalCostBasisOpen > 0 ? (totalUnrealisedGain / totalCostBasisOpen) * 100 : 0

  return {
    portfolioId,
    portfolioName,
    currency,
    holdings,
    totalInvested: invested,
    currentMarketValue,
    unrealisedGain: totalUnrealisedGain,
    unrealisedGainPct,
    realisedGain,
    dividendsReceived: dividends,
    totalReturn: totalReturnAbs,
    totalReturnPct,
  }
}
