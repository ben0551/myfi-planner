import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { computePortfolioPerformance } from '@/lib/calculations'
import { recordSnapshot } from '@/lib/snapshots'
import { recordNetWorthSnapshot } from '@/lib/netWorthSnapshot'
import { calcTermDeposit } from '@/lib/termDeposit'

// Called by an external scheduler (e.g. Docker cron, Traefik cron, or a simple curl job).
// Protect with CRON_SECRET env var so this endpoint can't be triggered by anyone.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── Portfolio snapshots ─────────────────────────────────────────────────────
  const portfolios = await prisma.portfolio.findMany({
    include: {
      transactions: { orderBy: { date: 'asc' } },
    },
  })

  const results: { portfolioId: string; name: string; value: number | null; error?: string }[] = []

  for (const portfolio of portfolios) {
    if (portfolio.transactions.length === 0) {
      results.push({ portfolioId: portfolio.id, name: portfolio.name, value: null })
      continue
    }

    try {
      const tickers = [...new Set(portfolio.transactions.map((t) => t.ticker.toUpperCase()))]
      const priceMap = await getCachedAsxQuotes(tickers)
      const perf = computePortfolioPerformance(
        portfolio.id,
        portfolio.name,
        portfolio.currency,
        portfolio.transactions,
        priceMap
      )
      await recordSnapshot(portfolio.id, perf.currentMarketValue, perf.totalInvested)
      results.push({ portfolioId: portfolio.id, name: portfolio.name, value: perf.currentMarketValue })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cron/snapshots] Failed for portfolio ${portfolio.id}:`, err)
      results.push({ portfolioId: portfolio.id, name: portfolio.name, value: null, error: msg })
    }
  }

  const snapped = results.filter((r) => r.value !== null).length

  // ── Net worth snapshots (per user) ──────────────────────────────────────────
  // Previously these were written on every dashboard/wealth page render — racy
  // and wasteful. Now consolidated here, run once per cron tick.
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  })

  let nwSnapped = 0
  for (const u of users) {
    try {
      const userId = u.id
      const [userPortfolios, properties, superAccounts, cashAccounts] = await Promise.all([
        prisma.portfolio.findMany({
          where: { userId },
          select: {
            id: true, portfolioType: true,
            tdPrincipal: true, tdRate: true, tdStartDate: true, tdMaturityDate: true,
          },
        }),
        prisma.property.findMany({ where: { userId, soldDate: null }, include: { mortgage: true } }),
        prisma.superAccount.findMany({ where: { userId }, select: { currentBalance: true } }),
        prisma.cashAccount.findMany({ where: { userId }, select: { balance: true } }),
      ])

      const latestSnapshots = userPortfolios.length > 0
        ? await prisma.portfolioSnapshot.findMany({
            where: { portfolioId: { in: userPortfolios.map((p) => p.id) } },
            orderBy: { date: 'desc' },
            distinct: ['portfolioId'],
            select: { portfolioId: true, value: true },
          })
        : []
      const snapMap = new Map(latestSnapshots.map((s) => [s.portfolioId, s.value]))

      const sharesValue = userPortfolios
        .filter((p) => p.portfolioType !== 'TERM_DEPOSIT')
        .reduce((s, p) => s + (snapMap.get(p.id) ?? 0), 0)

      let tdValue = 0
      for (const p of userPortfolios) {
        if (p.portfolioType !== 'TERM_DEPOSIT') continue
        if (p.tdPrincipal && p.tdRate && p.tdStartDate && p.tdMaturityDate) {
          tdValue += calcTermDeposit(p.tdPrincipal, p.tdRate, p.tdStartDate, p.tdMaturityDate).currentValue
        } else {
          tdValue += snapMap.get(p.id) ?? 0
        }
      }

      const propertyValue = properties.reduce((s, p) => s + p.currentValue * (p.ownershipPct / 100), 0)
      const totalMortgages = properties.reduce(
        (s, p) => s + (p.mortgage?.currentBalance ?? 0) * (p.ownershipPct / 100),
        0,
      )
      const superBalance = superAccounts.reduce((s, a) => s + a.currentBalance, 0)
      const cashBalance = cashAccounts.reduce((s, a) => s + a.balance, 0)

      const totalAssets = sharesValue + tdValue + propertyValue + superBalance + cashBalance
      const totalLiabilities = totalMortgages
      const netWorth = totalAssets - totalLiabilities

      await recordNetWorthSnapshot(userId, {
        totalAssets, totalLiabilities, netWorth,
        sharesValue, tdValue, propertyValue, superBalance, cashBalance,
      })
      nwSnapped++
    } catch (err) {
      console.error(`[cron/snapshots] NW snapshot failed for user ${u.id}:`, err)
    }
  }

  console.log(`[cron/snapshots] Portfolios: ${snapped}/${portfolios.length}, Net worth: ${nwSnapped}/${users.length}`)

  return Response.json({
    snapped, total: portfolios.length, results,
    netWorth: { snapped: nwSnapped, total: users.length },
  })
}
