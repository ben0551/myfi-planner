import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchYahooDividendHistory } from '@/lib/yahoo'
import { fetchMarketIndexDividendHistory } from '@/lib/marketindex'

const DEDUP_WINDOW_DAYS = 14  // consider same dividend if within ±14 days
const MAX_TICKERS = 30        // safety cap to avoid hammering Yahoo

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })
  if (portfolio.portfolioType === 'TERM_DEPOSIT') {
    return Response.json({ error: 'Term deposit portfolios do not have dividends' }, { status: 400 })
  }

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'asc' },
  })

  if (transactions.length === 0) {
    return Response.json({ created: 0, skipped: 0, errors: [] })
  }

  // ── Build per-ticker quantity timeline ──────────────────────────────────────
  // For each ticker, track quantity at each date so we know how many shares
  // were held on any given ex-dividend date.

  type QtyPoint = { date: Date; qty: number }
  const tickerQtyTimeline = new Map<string, QtyPoint[]>()

  for (const tx of transactions) {
    const ticker = tx.ticker.toUpperCase()
    if (!tickerQtyTimeline.has(ticker)) tickerQtyTimeline.set(ticker, [])
    const timeline = tickerQtyTimeline.get(ticker)!
    const lastQty = timeline.length > 0 ? timeline[timeline.length - 1].qty : 0
    const qty = Math.abs(Number(tx.quantity))

    let newQty = lastQty
    if (tx.type === 'BUY' || tx.type === 'DRP') newQty = lastQty + qty
    else if (tx.type === 'SELL') newQty = Math.max(0, lastQty - qty)
    // DIVIDEND transactions don't change quantity

    if (tx.type !== 'DIVIDEND') {
      timeline.push({ date: tx.date, qty: newQty })
    }
  }

  /** Returns shares held at a given date (carry-forward from last transaction on or before it) */
  function qtyAtDate(ticker: string, date: Date): number {
    const timeline = tickerQtyTimeline.get(ticker)
    if (!timeline || timeline.length === 0) return 0
    let qty = 0
    for (const point of timeline) {
      if (point.date <= date) qty = point.qty
      else break
    }
    return qty
  }

  // ── Get tickers that had holdings at some point ───────────────────────────
  const allTickers = Array.from(tickerQtyTimeline.keys()).slice(0, MAX_TICKERS)

  // ── Fetch existing DIVIDEND/DRP transactions for dedup ───────────────────
  const existingDivs = await prisma.transaction.findMany({
    where: { portfolioId: id, type: { in: ['DIVIDEND', 'DRP'] } },
    select: { ticker: true, date: true, amount: true },
  })

  function isDuplicate(ticker: string, exDate: Date, amount: number): boolean {
    const windowMs = DEDUP_WINDOW_DAYS * 86400 * 1000
    return existingDivs.some(
      (d) =>
        d.ticker.toUpperCase() === ticker &&
        Math.abs(d.date.getTime() - exDate.getTime()) <= windowMs
    )
  }

  // ── Main sync loop ────────────────────────────────────────────────────────
  let created = 0
  let skipped = 0
  const errors: string[] = []

  const toCreate: Parameters<typeof prisma.pendingTransaction.create>[0]['data'][] = []

  for (const ticker of allTickers) {
    try {
      const [dividends, miHistory] = await Promise.all([
        fetchYahooDividendHistory(ticker, 3),
        fetchMarketIndexDividendHistory(ticker),
      ])
      if (dividends.length === 0) continue

      // Build a lookup: exDate (YYYY-MM-DD) → frankingPct from MarketIndex
      const miByDate = new Map<string, number>()
      for (const mi of miHistory) {
        miByDate.set(mi.exDate.toISOString().split('T')[0], mi.frankingPct)
      }

      function frankingForDate(exDate: Date): number {
        const key = exDate.toISOString().split('T')[0]
        if (miByDate.has(key)) return miByDate.get(key)!
        // Fuzzy match within ±3 days (minor date alignment differences)
        const ts = exDate.getTime()
        for (const [k, v] of miByDate) {
          if (Math.abs(new Date(k).getTime() - ts) <= 3 * 86400 * 1000) return v
        }
        return 0
      }

      for (const div of dividends) {
        const qty = qtyAtDate(ticker, div.exDate)
        if (qty <= 0) {
          skipped++
          continue
        }

        if (isDuplicate(ticker, div.exDate, div.amountPerShare)) {
          skipped++
          continue
        }

        const totalAmount = qty * div.amountPerShare
        const frankingPct = frankingForDate(div.exDate)

        toCreate.push({
          source: 'yahoo-sync',
          rawContent: `Yahoo Finance dividend sync: ${ticker} ex-date ${div.exDate.toISOString().split('T')[0]}, $${div.amountPerShare.toFixed(4)}/share × ${qty} shares = $${totalAmount.toFixed(2)}`,
          transactionType: 'DIVIDEND',
          ticker,
          quantity: qty,
          price: div.amountPerShare,
          fees: 0,
          currency: portfolio.currency,
          tradeDate: div.exDate,
          parseConfidence: 0.8,
          parseWarnings: frankingPct > 0 ? `Franking: ${frankingPct}%` : null,
          status: 'PENDING',
          portfolioId: id,
          userId: session.user.id,
        })
        created++
      }
    } catch (err) {
      errors.push(`${ticker}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  // Batch-insert pending transactions
  if (toCreate.length > 0) {
    await prisma.pendingTransaction.createMany({ data: toCreate })
  }

  return Response.json({ created, skipped, errors })
}
