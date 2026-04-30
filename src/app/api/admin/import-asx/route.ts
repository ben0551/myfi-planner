import { requireAdmin } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'

const ASX_CSV_URL = 'https://www.asx.com.au/asx/research/ASXListedCompanies.csv'

// Parse a single CSV line — handles quoted fields containing commas
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
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

export async function POST() {
  const denied = await requireAdmin()
  if (denied) return denied

  let csvText: string
  try {
    const res = await fetch(ASX_CSV_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyFiPlanner/1.0)' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    csvText = await res.text()
  } catch (err) {
    return Response.json({
      error: `Failed to fetch ASX company list: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 502 })
  }

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)

  // Find the header row (contains "ASX code" or "ASX Code")
  let dataStart = 0
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const lower = lines[i].toLowerCase()
    if (lower.includes('asx code') || lower.includes('company name')) {
      dataStart = i + 1
      break
    }
  }

  interface AsxRow { ticker: string; companyName: string; sector: string | null }
  const rows: AsxRow[] = []

  for (let i = dataStart; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i])
    // ASX CSV format: Company name, ASX code, GICS industry group
    if (fields.length < 2) continue
    const companyName = fields[0].trim()
    const ticker = fields[1].trim().toUpperCase()
    const sector = fields[2]?.trim() || null

    // Basic validation: ASX codes are 2–6 alphanumeric chars
    if (!ticker || !/^[A-Z0-9]{2,6}$/.test(ticker)) continue
    if (!companyName) continue

    rows.push({ ticker, companyName, sector })
  }

  if (rows.length === 0) {
    return Response.json({ error: 'No valid rows found in CSV — format may have changed' }, { status: 422 })
  }

  // Load existing tickers to decide create vs update
  const existingTickers = new Set(
    (await prisma.marketIndexSnapshot.findMany({ select: { ticker: true } })).map((r) => r.ticker)
  )

  const epoch = new Date(0) // 1970-01-01 — signals "needs fundamentals sync"

  let created = 0
  let updated = 0
  let skipped = 0

  // Process in chunks to avoid hitting Prisma's parameter limit
  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    await Promise.allSettled(
      chunk.map(async ({ ticker, companyName, sector }) => {
        if (!existingTickers.has(ticker)) {
          // New ticker — create with epoch fetchedAt so batch sync picks it up first
          await prisma.marketIndexSnapshot.create({
            data: {
              ticker,
              companyName,
              sector,
              fetchedAt: epoch,
              updatedAt: new Date(),
            },
          })
          created++
        } else {
          // Existing — only fill in blanks, never overwrite real fundamentals data
          const existing = await prisma.marketIndexSnapshot.findUnique({
            where: { ticker },
            select: { companyName: true, sector: true },
          })
          if (!existing?.companyName || !existing?.sector) {
            await prisma.marketIndexSnapshot.update({
              where: { ticker },
              data: {
                companyName: existing?.companyName ?? companyName,
                sector: existing?.sector ?? sector,
              },
            })
            updated++
          } else {
            skipped++
          }
        }
      })
    )
  }

  return Response.json({
    total: rows.length,
    created,
    updated,
    skipped,
  })
}
