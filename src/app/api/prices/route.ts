import { NextRequest } from 'next/server'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { checkAlerts } from '@/lib/alerts/checker'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tickersParam = searchParams.get('tickers') ?? ''
  const tickers = tickersParam
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)

  if (tickers.length === 0) {
    return Response.json({ error: 'tickers parameter required' }, { status: 400 })
  }

  const priceMap = await getCachedAsxQuotes(tickers)
  await checkAlerts()

  const results = Object.fromEntries(priceMap)
  return Response.json(results)
}
