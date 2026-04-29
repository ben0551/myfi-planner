import type { ParsedTransaction } from './types'

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function parseAussieDate(s: string): Date | null {
  // Handles: "25 Apr 2026", "2026-04-25", "25/04/2026", "April 25, 2026"
  const patterns = [
    /(\d{1,2})\s+(\w+)\s+(\d{4})/,
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{1,2})\/(\d{2})\/(\d{4})/,
    /(\w+)\s+(\d{1,2}),\s*(\d{4})/,
  ]
  for (const p of patterns) {
    const m = s.match(p)
    if (m) {
      const d = new Date(m[0])
      if (!isNaN(d.getTime())) return d
    }
  }
  return null
}

function extractNumber(s: string): number | null {
  const m = s.match(/([\d,]+\.?\d*)/)
  if (!m) return null
  const n = parseFloat(m[1].replace(/,/g, ''))
  return isNaN(n) ? null : n
}

// Strip leading currency prefix like "A$", "US$", "$", "AU$"
function stripCurrency(s: string): string {
  return s.replace(/^[A-Z]{0,2}\$/, '').trim()
}

export function parseStakeEmail(
  text: string,
  html = ''
): ParsedTransaction {
  const src = text.length > 50 ? text : (text + ' ' + stripHtml(html)).trim()
  const warnings: string[] = []

  // --- Transaction type ---
  let transactionType: 'BUY' | 'SELL' | 'DIVIDEND' | null = null
  const typeMatch =
    src.match(/order\s+type[:\s]+(?:market\s+)?(buy|sell)/i) ??
    src.match(/(?:market\s+)?(buy|sell)\s+order/i) ??
    src.match(/you\s+(?:have\s+)?(?:bought|purchased|acquired)\b/i) ??
    src.match(/you\s+(?:have\s+)?sold\b/i) ??
    src.match(/\b(buy order|sell order)\b/i) ??
    src.match(/\b(dividend|distribution)\s+(?:payment|statement|received)\b/i)

  if (typeMatch) {
    const raw = (typeMatch[1] ?? typeMatch[0]).toLowerCase()
    if (/buy|bought|purchased|acquired/.test(raw)) transactionType = 'BUY'
    else if (/sell|sold/.test(raw)) transactionType = 'SELL'
    else if (/dividend|distribution/.test(raw)) transactionType = 'DIVIDEND'
  }
  if (!transactionType) {
    if (/\bbuy\b|\bbought\b/i.test(src)) transactionType = 'BUY'
    else if (/\bsell\b|\bsold\b/i.test(src)) transactionType = 'SELL'
    else if (/\bdividend\b|\bdistribution\b/i.test(src)) transactionType = 'DIVIDEND'
  }
  if (!transactionType) warnings.push('Could not determine transaction type')

  // --- Ticker ---
  // Try ASX-suffixed format first (e.g. HLI.ASX, CBA.AX), then fallback heuristics
  let ticker: string | null = null
  const tickerPatterns = [
    /\b([A-Z]{2,5})\.ASX\b/,                                       // Stake: HLI.ASX
    /\b([A-Z]{2,5})\.AX\b/,                                        // Yahoo: CBA.AX
    /equity[\s\n]+([A-Z]{2,5})\b/i,                                // Stake dividend: EQUITY\nRMC
    /ticker[:\s]+([A-Z]{2,5})/i,
    /stock\s+code[:\s]+([A-Z]{2,5})/i,
    /security[:\s]+([A-Z]{2,5})/i,
    /symbol[:\s]+([A-Z]{2,5})/i,
    /(?:order|filled|trade)[^\n]{0,30}[\-–]\s*([A-Z]{2,5})\b/,
    /\b([A-Z]{2,5})\s+(?:shares|units|stock)\b/,
  ]
  for (const p of tickerPatterns) {
    const m = src.match(p)
    if (m?.[1] && /^[A-Z]{2,5}$/.test(m[1])) {
      ticker = m[1].toUpperCase()
      break
    }
  }
  if (!ticker) warnings.push('Could not extract ticker symbol')

  // --- Quantity ---
  let quantity: number | null = null
  const qtyPatterns = [
    // Stake: "Shares\n2177 of 2177" or "2177 of 2177 shares"
    /shares?\s+(\d[\d,]*)\s+of\s+[\d,]+/i,
    /(\d[\d,]*)\s+of\s+[\d,]+\s+shares?/i,
    // Generic labelled patterns
    /units?\s+(?:filled|ordered|purchased|sold)[:\s]+([\d,]+\.?\d*)/i,
    /(?:no\.|number)\s+of\s+(?:shares|units)[:\s]+([\d,]+\.?\d*)/i,
    /shares?\s+(?:quantity|qty)[:\s]+([\d,]+\.?\d*)/i,
    /quantity[:\s]+([\d,]+\.?\d*)/i,
    /([\d,]+\.?\d*)\s+units?\s+(?:of|@|at)/i,
    /([\d,]+\.?\d*)\s+shares?\s+(?:of|@|at)/i,
  ]
  for (const p of qtyPatterns) {
    const m = src.match(p)
    if (m) { quantity = extractNumber(m[1]); break }
  }
  if (quantity === null) warnings.push('Could not extract quantity')

  // --- Price per unit ---
  let price: number | null = null
  const pricePatterns = [
    // Stake: "Effective price\nA$4.5586"
    /effective\s+price[:\s]+([A-Z]{0,2}\$[\d,]+\.?\d*)/i,
    /price\s+per\s+(?:unit|share)[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
    /(?:unit|share)\s+price[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
    /execution\s+price[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
    /average\s+price[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
    /filled\s+at[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
    /@\s*[A-Z]{0,2}\$?([\d,]+\.?\d*)\s+per/i,
  ]
  for (const p of pricePatterns) {
    const m = src.match(p)
    if (m) {
      price = extractNumber(stripCurrency(m[1]))
      if (price !== null) break
    }
  }
  if (price === null && transactionType === 'DIVIDEND') price = 0
  if (price === null) warnings.push('Could not extract price per unit')

  // --- Fees / brokerage ---
  // Handle "A$", "AU$", plain "$" prefixes
  let fees: number | null = null
  const feePatterns = [
    /brokerage[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
    /commission[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
    /fee[s]?[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
    /transaction\s+(?:fee|cost)[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
  ]
  for (const p of feePatterns) {
    const m = src.match(p)
    if (m) { fees = extractNumber(m[1]); break }
  }
  if (fees === null) fees = 0

  // --- Dividend amount (for DIVIDEND type) ---
  let dividendAmount: number | null = null
  if (transactionType === 'DIVIDEND') {
    const divPatterns = [
      /(?:total\s+)?(?:dividend|distribution|payment)\s+amount[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
      /amount\s+(?:paid|received|payable)[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
      /(?:net\s+)?payment[:\s]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
      // Stake: "AMOUNT\nA$187.98" or "credited with A$187.98"
      /\bamount[\s\n]+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
      /credited\s+with\s+[A-Z]{0,2}\$?([\d,]+\.?\d*)/i,
    ]
    for (const p of divPatterns) {
      const m = src.match(p)
      if (m) { dividendAmount = extractNumber(m[1]); break }
    }
  }

  // --- Trade date ---
  let tradeDate: Date | null = null
  const datePatterns = [
    /(?:settlement|trade|order|execution|payment)\s+date[:\s]+([^\n]{5,25})/i,
    /filled\s+on\s+([^\n(]{5,25})/i,          // Stake: "filled on 16 Mar 2026 (AET)"
    /date[:\s]+([0-9]{1,2}[\s\/\-][A-Za-z0-9]{2,9}[\s\/\-][0-9]{4})/i,
  ]
  for (const p of datePatterns) {
    const m = src.match(p)
    if (m) {
      tradeDate = parseAussieDate(m[1].trim())
      if (tradeDate) break
    }
  }
  if (!tradeDate) {
    // Fallback: any "DD Mon YYYY" in the text
    const anyDate = src.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})\b/i)
    if (anyDate) tradeDate = parseAussieDate(anyDate[1])
  }
  if (!tradeDate) {
    tradeDate = new Date()
    warnings.push('Could not extract trade date — defaulted to today')
  }

  const keyFields = [transactionType, ticker, quantity, price, tradeDate]
  const parseConfidence = keyFields.filter(Boolean).length / keyFields.length

  return {
    transactionType,
    ticker,
    quantity,
    price: transactionType === 'DIVIDEND' ? dividendAmount : price,
    fees,
    currency: 'AUD',
    tradeDate,
    parseConfidence,
    parseWarnings: warnings,
  }
}
