/**
 * MarketIndex scraper — fetches https://www.marketindex.com.au/asx/{ticker}
 * and extracts key stock data into a structured object.
 *
 * Uses node:https directly (same pattern as yahoo.ts) to send full browser
 * headers and avoid undici/proxy issues that cause 403s with global fetch.
 *
 * Parsing strategy (in priority order):
 *   1. JSON-LD structured data (<script type="application/ld+json">)
 *   2. Open Graph / meta tags
 *   3. Regex patterns targeting common HTML patterns on their pages
 *
 * All fields are optional — partial data is better than nothing.
 */
import https from 'node:https'

export interface MarketIndexData {
  ticker: string
  companyName: string | null
  price: number | null
  change: number | null
  changePct: number | null
  volume: string | null
  marketCap: string | null
  peRatio: number | null
  eps: number | null
  dividendYield: number | null
  dividendAmount: number | null
  frankingPct: number | null
  high52Week: number | null
  low52Week: number | null
  sector: string | null
  industry: string | null
  extras: Record<string, string>
}

function parseNumber(s: string | null | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s.replace(/[,$%]/g, '').trim())
  return isNaN(n) ? null : n
}

function extractMeta(html: string, property: string): string | null {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'))
  return m?.[1] ?? null
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const m = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!m) return null
  try {
    const parsed = JSON.parse(m[1])
    // May be an array
    return Array.isArray(parsed) ? parsed[0] : parsed
  } catch {
    return null
  }
}

/** Extract a value following a label in a table or definition list */
function extractAfterLabel(html: string, label: string): string | null {
  // Matches: <td>Label</td><td>VALUE</td>  or  <dt>Label</dt><dd>VALUE</dd>
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = html.match(
    new RegExp(`(?:<td[^>]*>\\s*${escaped}[^<]*</td>\\s*<td[^>]*>([^<]+)</td>|<dt[^>]*>\\s*${escaped}[^<]*</dt>\\s*<dd[^>]*>([^<]+)</dd>)`, 'i')
  )
  return m ? (m[1] ?? m[2] ?? null)?.trim() ?? null : null
}

/** Strip HTML tags from a string */
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

/** Fetch a URL via node:https, following one redirect, returning the body string. */
function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
        Referer: 'https://www.marketindex.com.au/',
      },
      // Tolerate self-signed certs (corporate proxy)
      rejectUnauthorized: false,
    }

    const req = https.get(options, (res) => {
      // Follow redirect (301/302)
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        httpsGet(res.headers.location).then(resolve).catch(reject)
        res.resume()
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

export async function fetchMarketIndexData(ticker: string): Promise<MarketIndexData | null> {
  const url = `https://www.marketindex.com.au/asx/${ticker.toLowerCase()}`

  let html: string
  try {
    html = await httpsGet(url)
  } catch (err) {
    console.error(`[marketindex] fetch failed for ${ticker}:`, err)
    return null
  }

  const result: MarketIndexData = {
    ticker: ticker.toUpperCase(),
    companyName: null,
    price: null,
    change: null,
    changePct: null,
    volume: null,
    marketCap: null,
    peRatio: null,
    eps: null,
    dividendYield: null,
    dividendAmount: null,
    frankingPct: null,
    high52Week: null,
    low52Week: null,
    sector: null,
    industry: null,
    extras: {},
  }

  // ── 1. JSON-LD ──────────────────────────────────────────────────────────────
  const jsonLd = extractJsonLd(html)
  if (jsonLd) {
    if (typeof jsonLd.name === 'string') result.companyName = jsonLd.name
    if (typeof jsonLd.tickerSymbol === 'string') result.ticker = jsonLd.tickerSymbol.toUpperCase()
  }

  // ── 2. Open Graph / meta ────────────────────────────────────────────────────
  const ogTitle = extractMeta(html, 'og:title')
  if (ogTitle && !result.companyName) {
    // e.g. "ANZ Banking Group (ANZ) Share Price - MarketIndex"
    const nameMatch = ogTitle.match(/^(.+?)\s*\([A-Z]{1,6}\)/)
    if (nameMatch) result.companyName = nameMatch[1].trim()
  }

  const ogDesc = extractMeta(html, 'og:description') ?? extractMeta(html, 'description')
  if (ogDesc) {
    // e.g. "ANZ last traded at $28.50, up $0.45 (+1.60%)"
    const priceMatch = ogDesc.match(/\$([0-9]+(?:\.[0-9]+)?)/);
    if (priceMatch && !result.price) result.price = parseNumber(priceMatch[1])

    const changePctMatch = ogDesc.match(/([+-]?[0-9]+\.[0-9]+)%/)
    if (changePctMatch && !result.changePct) result.changePct = parseNumber(changePctMatch[1])

    const changeMatch = ogDesc.match(/(?:up|down)\s+\$([0-9]+(?:\.[0-9]+)?)/)
    if (changeMatch) {
      const v = parseNumber(changeMatch[1])
      result.change = ogDesc.toLowerCase().includes('down') ? -(v ?? 0) : v
    }
  }

  // ── 3. HTML pattern matching ─────────────────────────────────────────────────

  // Price — common patterns: data-price, class containing "price", or large number near ticker
  if (!result.price) {
    const pricePatterns = [
      /data-price=["']([0-9]+\.[0-9]+)["']/i,
      /class=["'][^"']*(?:last-price|current-price|share-price)[^"']*["'][^>]*>[\s$]*([0-9]+\.[0-9]+)/i,
      /"price"\s*:\s*([0-9]+\.[0-9]+)/,
      /"lastPrice"\s*:\s*([0-9]+\.[0-9]+)/,
      /"last"\s*:\s*([0-9]+\.[0-9]+)/,
    ]
    for (const pat of pricePatterns) {
      const m = html.match(pat)
      if (m) { result.price = parseNumber(m[1]); break }
    }
  }

  // Change / change pct
  if (!result.change) {
    const m = html.match(/["']change["']\s*:\s*([-0-9.]+)/)
    if (m) result.change = parseNumber(m[1])
  }
  if (!result.changePct) {
    const m = html.match(/["'](?:changePercent|changePct|change_percent)["']\s*:\s*([-0-9.]+)/)
    if (m) result.changePct = parseNumber(m[1])
  }

  // Volume
  if (!result.volume) {
    const m = html.match(/["']volume["']\s*:\s*["']?([0-9,]+)["']?/)
      ?? html.match(/Volume[^<]*<[^>]+>([0-9,.]+[KMB]?)/i)
    if (m) result.volume = m[1].trim()
  }

  // Market cap
  if (!result.marketCap) {
    const m = html.match(/(?:Market Cap|Mkt Cap)[^<]*<[^>]+>\s*\$?([0-9,.]+[BMK]?)/i)
      ?? html.match(/["'](?:marketCap|market_cap)["']\s*:\s*["']?([^"',}\s]+)["']?/)
    if (m) result.marketCap = stripTags(m[1]).trim()
  }

  // P/E ratio
  if (!result.peRatio) {
    const raw = extractAfterLabel(html, 'P/E') ?? extractAfterLabel(html, 'PE Ratio')
      ?? html.match(/["'](?:pe|peRatio|pe_ratio)["']\s*:\s*([-0-9.]+)/)?.[1]
    result.peRatio = parseNumber(raw)
  }

  // EPS
  if (!result.eps) {
    const raw = extractAfterLabel(html, 'EPS')
      ?? html.match(/["']eps["']\s*:\s*([-0-9.]+)/)?.[1]
    result.eps = parseNumber(raw)
  }

  // Dividend yield
  if (!result.dividendYield) {
    const raw = extractAfterLabel(html, 'Dividend Yield') ?? extractAfterLabel(html, 'Div Yield')
      ?? html.match(/["'](?:dividendYield|dividend_yield)["']\s*:\s*([-0-9.]+)/)?.[1]
    result.dividendYield = parseNumber(raw)
  }

  // Dividend amount
  if (!result.dividendAmount) {
    const raw = extractAfterLabel(html, 'Annual Dividend') ?? extractAfterLabel(html, 'Dividend')
    result.dividendAmount = parseNumber(raw)
  }

  // Franking %
  if (!result.frankingPct) {
    const raw = extractAfterLabel(html, 'Franking')
      ?? html.match(/(?:Franking)[^%]*?([0-9]+)%/i)?.[1]
    const n = parseNumber(raw)
    if (n !== null) result.frankingPct = Math.round(n)
  }

  // 52-week range
  if (!result.high52Week || !result.low52Week) {
    const rangeRaw = extractAfterLabel(html, '52 Week Range') ?? extractAfterLabel(html, '52 Week')
    if (rangeRaw) {
      const parts = rangeRaw.match(/([\d.]+)[^0-9]+([\d.]+)/)
      if (parts) {
        result.low52Week = parseNumber(parts[1])
        result.high52Week = parseNumber(parts[2])
      }
    }
    if (!result.high52Week) {
      const m = html.match(/["'](?:fiftyTwoWeekHigh|week52High)["']\s*:\s*([-0-9.]+)/)
      if (m) result.high52Week = parseNumber(m[1])
    }
    if (!result.low52Week) {
      const m = html.match(/["'](?:fiftyTwoWeekLow|week52Low)["']\s*:\s*([-0-9.]+)/)
      if (m) result.low52Week = parseNumber(m[1])
    }
  }

  // Sector / Industry
  if (!result.sector) {
    const raw = extractAfterLabel(html, 'Sector')
      ?? html.match(/["']sector["']\s*:\s*["']([^"']+)["']/)?.[1]
    result.sector = raw ? stripTags(raw).trim() : null
  }
  if (!result.industry) {
    const raw = extractAfterLabel(html, 'Industry')
      ?? html.match(/["']industry["']\s*:\s*["']([^"']+)["']/)?.[1]
    result.industry = raw ? stripTags(raw).trim() : null
  }

  // Company name fallback — from <title> tag
  if (!result.companyName) {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    if (titleMatch) {
      const titleText = titleMatch[1]
      const nameMatch = titleText.match(/^(.+?)\s*(?:\([A-Z]{1,6}\))?\s*[-|]/)
      if (nameMatch) result.companyName = nameMatch[1].trim()
    }
  }

  return result
}
