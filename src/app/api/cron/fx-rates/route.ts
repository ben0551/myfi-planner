import { NextRequest } from 'next/server'
import { refreshEcbRates } from '@/lib/fx'

/**
 * Refresh ECB FX rates. Call once daily (rates are published ~16:00 CET).
 * Protect with CRON_SECRET as with /api/cron/snapshots.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const result = await refreshEcbRates()
  if ('error' in result) {
    console.error('[cron/fx-rates] failed:', result.error)
    return Response.json(result, { status: 502 })
  }
  console.log(`[cron/fx-rates] Cached ${result.count} rates for ${result.date}`)
  return Response.json(result)
}
