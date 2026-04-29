import { prisma } from '../prisma'

export async function checkAlerts(): Promise<void> {
  try {
    const activeAlerts = await prisma.priceAlert.findMany({
      where: { isTriggered: false },
    })

    if (activeAlerts.length === 0) return

    const tickers = [...new Set(activeAlerts.map((a) => a.ticker))]
    const caches = await prisma.priceCache.findMany({
      where: { ticker: { in: tickers } },
    })
    const priceMap = new Map(caches.map((c) => [c.ticker, c.price.toNumber()]))

    for (const alert of activeAlerts) {
      const price = priceMap.get(alert.ticker.toUpperCase())
      if (price === undefined) continue

      const triggered =
        (alert.direction === 'ABOVE' && price >= alert.targetPrice) ||
        (alert.direction === 'BELOW' && price <= alert.targetPrice)

      if (triggered) {
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: {
            isTriggered: true,
            triggeredAt: new Date(),
            triggeredPrice: price,
          },
        })
      }
    }
  } catch {
    // Non-critical — swallow errors
  }
}
