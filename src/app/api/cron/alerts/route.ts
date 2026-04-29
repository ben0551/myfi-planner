import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCachedAsxQuotes } from '@/lib/asx/cache'

// Checks all untriggered price alerts against current market prices.
// Call alongside cron/snapshots — e.g. after the daily snapshot run.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const alerts = await prisma.priceAlert.findMany({
    where: { isTriggered: false },
  })

  if (alerts.length === 0) {
    return Response.json({ checked: 0, triggered: 0 })
  }

  const tickers = [...new Set(alerts.map((a) => a.ticker.toUpperCase()))]
  const priceMap = await getCachedAsxQuotes(tickers)

  let triggered = 0
  const now = new Date()

  await Promise.allSettled(
    alerts.map(async (alert) => {
      const quote = priceMap.get(alert.ticker.toUpperCase())
      if (!quote) return

      const price = quote.price
      const hit =
        alert.direction === 'ABOVE'
          ? price >= alert.targetPrice
          : price <= alert.targetPrice

      if (hit) {
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: { isTriggered: true, triggeredAt: now, triggeredPrice: price },
        })
        triggered++
        console.log(
          `[cron/alerts] ${alert.ticker} ${alert.direction} $${alert.targetPrice} — hit at $${price}`
        )
      }
    })
  )

  return Response.json({ checked: alerts.length, triggered })
}
