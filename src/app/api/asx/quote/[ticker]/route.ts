import { NextRequest } from 'next/server'
import { getCachedAsxQuotes } from '@/lib/asx/cache'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const priceMap = await getCachedAsxQuotes([ticker.toUpperCase()])
  const quote = priceMap.get(ticker.toUpperCase())
  if (!quote) return Response.json({ error: 'Quote not available' }, { status: 404 })
  return Response.json(quote)
}
