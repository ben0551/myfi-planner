import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import https from 'node:https'

export interface SearchResult {
  ticker: string   // ASX ticker without .AX suffix
  name: string
  type: string     // 'Equity', 'ETF', etc.
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
          'Accept-Language': 'en-AU,en;q=0.9',
        },
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json([], { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) return Response.json([])

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-AU&region=AU&quotesCount=10&newsCount=0&enableFuzzyQuery=true&enableCb=false&enableNavLinks=false`
    const raw = await httpsGet(url)
    const data = JSON.parse(raw)

    // Yahoo returns { quotes: [...], news: [...] } at the top level
    const rawQuotes: {
      symbol?: string
      shortname?: string
      longname?: string
      exchDisp?: string
      quoteType?: string
      typeDisp?: string
    }[] = data?.quotes ?? []

    const quotes: SearchResult[] = rawQuotes
      .filter((q) => q.symbol?.endsWith('.AX') || q.exchDisp === 'ASX')
      .map((q) => ({
        ticker: (q.symbol ?? '').replace(/\.AX$/i, '').toUpperCase(),
        name: q.longname ?? q.shortname ?? q.symbol ?? '',
        type: q.typeDisp ?? q.quoteType ?? 'Equity',
      }))
      .filter((q) => q.ticker)

    return Response.json(quotes)
  } catch (err) {
    console.error('[research/search] failed:', err)
    return Response.json([])
  }
}
