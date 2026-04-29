// AU bank CSV parser + keyword auto-categoriser
// Handles: CBA, ANZ, NAB, Westpac, Up Bank, ING, Bendigo

export interface BankTransaction {
  date: Date
  description: string
  amount: number      // negative = debit (expense), positive = credit (income)
  balance: number | null
  rawRow: string
}

export interface ParseResult {
  transactions: BankTransaction[]
  detectedFormat: string
  errors: string[]
}

// ── CSV tokeniser ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(parseCSVLine)
}

// ── Date parsing (AU-first: DD/MM/YYYY, then ISO YYYY-MM-DD) ─────────────────

function parseDate(raw: string): Date | null {
  const s = raw.trim().replace(/['"]/g, '')

  // DD/MM/YYYY or D/M/YYYY
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    const date = new Date(Date.UTC(+y, +m - 1, +d))
    if (!isNaN(date.getTime())) return date
  }

  // YYYY-MM-DD (ISO)
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const date = new Date(Date.UTC(+y, +m - 1, +d))
    if (!isNaN(date.getTime())) return date
  }

  // DD-MM-YYYY
  const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dmyDash) {
    const [, d, m, y] = dmyDash
    const date = new Date(Date.UTC(+y, +m - 1, +d))
    if (!isNaN(date.getTime())) return date
  }

  return null
}

function parseAmount(raw: string): number | null {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return null
  const cleaned = raw.replace(/[,$"' ]/g, '').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// ── Column detection ──────────────────────────────────────────────────────────

type Format = 'amount' | 'debit_credit'

interface ColMap {
  format: Format
  dateIdx: number
  descIdx: number
  amountIdx?: number
  debitIdx?: number
  creditIdx?: number
  balanceIdx?: number
  label: string
}

function normalise(s: string) { return s.toLowerCase().replace(/[^a-z]/g, '') }

function detectColumns(headers: string[]): ColMap | null {
  const h = headers.map(normalise)

  const dateIdx   = h.findIndex((c) => c === 'date' || c === 'transactiondate' || c === 'valuedate')
  const descIdx   = h.findIndex((c) => ['description', 'particulars', 'narrative', 'details', 'memo', 'payee'].includes(c))
  const amountIdx = h.findIndex((c) => ['amount', 'transactionamount', 'value'].includes(c))
  const debitIdx  = h.findIndex((c) => ['debit', 'withdrawal', 'dr', 'withdrawalamount'].includes(c))
  const creditIdx = h.findIndex((c) => ['credit', 'deposit', 'cr', 'depositamount'].includes(c))
  const balIdx    = h.findIndex((c) => ['balance', 'runningbalance', 'closingbalance'].includes(c))

  if (dateIdx === -1 || descIdx === -1) return null

  if (amountIdx !== -1) {
    return { format: 'amount', dateIdx, descIdx, amountIdx, balanceIdx: balIdx >= 0 ? balIdx : undefined, label: 'Single amount' }
  }
  if (debitIdx !== -1 && creditIdx !== -1) {
    return { format: 'debit_credit', dateIdx, descIdx, debitIdx, creditIdx, balanceIdx: balIdx >= 0 ? balIdx : undefined, label: 'Debit/Credit split' }
  }

  return null
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseBankCSV(text: string): ParseResult {
  const errors: string[] = []
  const rows = parseCSV(text)

  if (rows.length < 2) {
    return { transactions: [], detectedFormat: 'Unknown', errors: ['File appears empty or has no data rows'] }
  }

  // Find header row — skip any preamble rows (some banks include account info first)
  let headerRowIdx = 0
  let colMap: ColMap | null = null
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const candidate = detectColumns(rows[i])
    if (candidate) { colMap = candidate; headerRowIdx = i; break }
  }

  if (!colMap) {
    return {
      transactions: [],
      detectedFormat: 'Unknown',
      errors: ['Could not detect columns. Expected headers containing Date, Description, and Amount (or Debit/Credit). Check that you exported as CSV.'],
    }
  }

  const transactions: BankTransaction[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.every((c) => c === '')) continue  // blank row

    const rawDate = row[colMap.dateIdx] ?? ''
    const desc = row[colMap.descIdx]?.replace(/^["']|["']$/g, '') ?? ''
    const balRaw = colMap.balanceIdx !== undefined ? row[colMap.balanceIdx] : undefined

    const date = parseDate(rawDate)
    if (!date) {
      // Skip rows that look like footers/totals rather than error
      if (rawDate === '' || normalise(rawDate).startsWith('total') || normalise(rawDate).startsWith('closing')) continue
      errors.push(`Row ${i + 1}: unrecognised date "${rawDate}"`)
      continue
    }

    let amount: number | null = null

    if (colMap.format === 'amount') {
      amount = parseAmount(row[colMap.amountIdx!] ?? '')
    } else {
      // debit/credit split — debits are expenses (negative), credits are income (positive)
      const debit  = parseAmount(row[colMap.debitIdx!] ?? '')
      const credit = parseAmount(row[colMap.creditIdx!] ?? '')
      if (debit !== null && debit !== 0) amount = -Math.abs(debit)
      else if (credit !== null && credit !== 0) amount = Math.abs(credit)
    }

    if (amount === null) {
      errors.push(`Row ${i + 1}: could not parse amount`)
      continue
    }

    const balance = balRaw !== undefined ? (parseAmount(balRaw) ?? null) : null

    transactions.push({ date, description: desc, amount, balance, rawRow: row.join(',') })
  }

  return { transactions, detectedFormat: colMap.label, errors }
}

// ── Keyword auto-categoriser ──────────────────────────────────────────────────
// Maps description keywords → budget category name (matches AU_DEFAULT_CATEGORIES)

const KEYWORD_RULES: { keywords: string[]; category: string }[] = [
  // Income
  { keywords: ['salary', 'payroll', 'wages', 'wage', 'payg', 'pay slip', 'employer'], category: 'Salary / Wages' },
  { keywords: ['centrelink', 'family tax', 'govt pay', 'government pay', 'youth allow', 'newstart', 'jobseeker'], category: 'Other Income' },
  { keywords: ['tax refund', 'ato refund', 'tax return'], category: 'Other Income' },
  // Mortgage / Rent
  { keywords: ['mortgage', 'home loan', 'homeloan', 'loan repay', 'cba home', 'anz home', 'nab home', 'westpac home', 'rent payment', 'rental payment', 'rea ', 'real estate'], category: 'Mortgage / Rent' },
  // Groceries
  { keywords: ['woolworths', 'woolies', 'coles', 'aldi', 'iga', 'costco', 'harris farm', 'foodland', 'supa valu', 'supabarn', 'drakes', 'spudshed', 'ritchies', 'fruit market', 'fresh market'], category: 'Groceries' },
  // Electricity & Gas
  { keywords: ['origin energy', 'agl', 'energy australia', 'energyaustralia', 'lumo energy', 'powershop', 'alinta', 'simply energy', 'energy qld', 'synergy', 'aurora energy', 'ergon', 'red energy', 'electricity', 'gas bill', 'natural gas'], category: 'Electricity & Gas' },
  // Water & Rates
  { keywords: ['sydney water', 'melbourne water', 'yarra valley water', 'south east water', 'western water', 'sa water', 'actew', 'watercorp', 'council rates', 'city council', 'shire council', 'land tax', 'water rates'], category: 'Water & Rates' },
  // Internet & Phone
  { keywords: ['telstra', 'optus', 'vodafone', 'tpg', 'internode', 'aussie broadband', 'aussie bb', 'iinet', 'dodo', 'amaysim', 'boost mobile', 'circles life', 'belong', 'kogan mobile', 'aldi mobile', 'nbn', 'internet', 'broadband'], category: 'Internet & Phone' },
  // Dining & Takeaway
  { keywords: ["mcdonald's", 'mcdonalds', 'kfc', 'hungry jacks', 'subway', 'dominos', 'domino', 'pizza hut', 'guzman', 'oporto', 'red rooster', 'nandos', "nando's", 'grill', 'uber eats', 'ubereats', 'menulog', 'doordash', 'deliveroo', 'just eat', 'cafe ', 'coffee', 'restaurant', 'bistro', 'tavern', 'thai', 'sushi', 'chinese', 'indian restaurant', 'pizz'], category: 'Dining & Takeaway' },
  // Entertainment
  { keywords: ['cinema', 'event cinema', 'hoyts', 'village cinema', 'reading cinema', 'ticketek', 'ticketmaster', 'moshtix', 'airbnb', 'hotel', 'booking.com', 'expedia', 'trivago', 'pub ', 'bar ', 'nightclub', 'bowling'], category: 'Entertainment' },
  // Subscriptions
  { keywords: ['netflix', 'spotify', 'amazon prime', 'prime video', 'disney+', 'disney plus', 'binge', 'stan ', 'foxtel', 'kayo', 'apple tv', 'apple one', 'youtube premium', 'audible', 'adobe', 'microsoft 365', 'office 365', 'dropbox', 'icloud'], category: 'Subscriptions' },
  // Clothing
  { keywords: ['cotton on', 'target ', 'kmart ', 'h&m', 'uniqlo', 'zara', 'myer', 'david jones', 'country road', 'lorna jane', 'rebel sport', 'sports direct', 'anaconda', 'kathmandu', 'the iconic', 'asos', 'clothing', 'fashion', 'apparel'], category: 'Clothing' },
  // Fuel
  { keywords: ['bp ', 'caltex', 'ampol', 'shell ', 'puma energy', 'metro petroleum', '7-eleven fuel', '7eleven fuel', 'petrol', 'diesel', 'fuel station', 'service station', 'united petrol'], category: 'Fuel' },
  // Rego
  { keywords: ['rms ', 'vicroads', 'vic roads', 'qld transport', 'sa rego', 'rego', 'vehicle registration', 'ctp insurance', 'green slip'], category: 'Registration & CTP' },
  // Public Transport
  { keywords: ['opal', 'myki', 'go card', 'translink', 'metro trains', 'ptv ', 'public transport', 'bus ticket', 'train ticket', 'ferry', 'tram '], category: 'Public Transport' },
  // Health Insurance
  { keywords: ['medibank', 'bupa', 'hcf ', 'nib health', 'hbf ', 'ahm health', 'australian unity', 'health insurance', 'phi ', 'private health'], category: 'Health Insurance (PHI)' },
  // Medical
  { keywords: ['doctor', 'gp ', 'medical centre', 'medical center', 'hospital', 'pathology', 'radiology', 'specialist', 'physiotherapy', 'physio', 'dentist', 'dental', 'optometrist', 'optical', 'bulk bill', 'medicare'], category: 'Medical & Dental' },
  // Pharmacy
  { keywords: ['chemist warehouse', 'priceline', 'terry white', 'discount chemist', 'pharmacy', 'chemist'], category: 'Medical & Dental' },
  // Gym
  { keywords: ['fitness first', 'anytime fitness', 'goodlife', 'f45', 'crossfit', 'yoga', 'pilates', 'swim centre', 'aquatic centre', 'gym ', 'planet fitness', 'snap fitness'], category: 'Gym & Fitness' },
  // Savings / Investments
  { keywords: ['commsec', 'comsec', 'selfwealth', 'stake ', 'ig trading', 'nabtrade', 'etoro', 'superhero', 'chess holding', 'vanguard', 'blackrock'], category: 'Investments' },
  { keywords: ['super contribution', 'voluntary super', 'salary sacrifice', 'rest super', 'australian super', 'australiansuper', 'sunsuper', 'hostplus', 'cbus', 'hesta'], category: 'Voluntary Super' },
  // Holidays
  { keywords: ['jetstar', 'qantas', 'virgin australia', 'tigerair', 'rex airline', 'flight ', 'airfare', 'tripadvisor', 'travel agent', 'holiday inn', 'hilton', 'marriott', 'hyatt', 'novotel', 'mercure'], category: 'Holidays' },
  // Gifts
  { keywords: ['gift ', 'florist', 'donate', 'donation', 'charity', 'gofundme', 'red cross', 'salvos', 'oxfam', 'worldvision'], category: 'Gifts & Donations' },
  // Home
  { keywords: ['bunnings', 'mitre 10', 'bbc hardware', 'total tools', 'masters ', 'home depot', 'ikea', 'plumber', 'electrician', 'handyman', 'harvey norman', 'jb hi-fi', 'jbhifi', 'good guys', 'appliances online', 'plumbing', 'landscaping', 'tradesman'], category: 'Home Maintenance' },
]

export function suggestCategory(description: string): string | null {
  const lower = description.toLowerCase()
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category
    }
  }
  return null
}
