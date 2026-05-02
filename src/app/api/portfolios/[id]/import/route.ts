import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Expected CSV columns (case-insensitive, order flexible):
// Date, Type, Ticker, Quantity, Price, Fees, Amount, Franking %, Notes

const VALID_TYPES = ['BUY', 'SELL', 'DIVIDEND', 'DRP'] as const

function parseRow(headers: string[], cells: string[]): Record<string, string> {
  const row: Record<string, string> = {}
  headers.forEach((h, i) => {
    row[h.toLowerCase().replace(/[^a-z%]/g, '')] = (cells[i] ?? '').trim().replace(/^"|"$/g, '')
  })
  return row
}

interface ParsedTx {
  type: string
  ticker: string
  date: string
  quantity: number
  price: number
  fees: number
  amount: number | null
  frankingPct: number
  notes: string | null
}

interface ParseError {
  row: number
  message: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
  })
  if (!portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as { rows: Record<string, string>[]; preview?: boolean }

  const parsed: ParsedTx[] = []
  const errors: ParseError[] = []

  body.rows.forEach((row, i) => {
    const rowNum = i + 2 // 1-indexed + header row
    const type = (row['type'] ?? '').toUpperCase()
    const ticker = (row['ticker'] ?? '').toUpperCase().trim()
    const dateStr = row['date'] ?? ''
    const qty = parseFloat(row['quantity'] ?? '0') || 0
    const price = parseFloat(row['price'] ?? '0') || 0
    const fees = parseFloat(row['fees'] ?? '0') || 0
    const amount = row['amount'] ? parseFloat(row['amount']) : null
    const frankingPct = parseFloat(row['franking%'] ?? row['frankingpct'] ?? '0') || 0
    const notes = row['notes'] ? row['notes'] : null

    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      errors.push({ row: rowNum, message: `Invalid type "${type}" — must be BUY, SELL, DIVIDEND, or DRP` })
      return
    }
    if (!ticker) {
      errors.push({ row: rowNum, message: 'Missing ticker' })
      return
    }
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      errors.push({ row: rowNum, message: `Invalid date "${dateStr}"` })
      return
    }
    if (type !== 'DIVIDEND' && qty <= 0) {
      errors.push({ row: rowNum, message: `Quantity must be > 0 for ${type}` })
      return
    }
    if (type === 'DIVIDEND' && (amount === null || isNaN(amount))) {
      errors.push({ row: rowNum, message: 'DIVIDEND rows must have an Amount' })
      return
    }
    if (type === 'DRP' && (qty <= 0 || price <= 0)) {
      errors.push({ row: rowNum, message: 'DRP rows must have Quantity and Price > 0' })
      return
    }

    parsed.push({ type, ticker, date: date.toISOString(), quantity: qty, price, fees, amount, frankingPct, notes })
  })

  // Preview mode — return parsed rows + errors without writing
  if (body.preview) {
    return NextResponse.json({ parsed, errors, total: body.rows.length })
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation errors', errors }, { status: 422 })
  }

  // Bulk insert
  await prisma.transaction.createMany({
    data: parsed.map((t) => ({
      portfolioId: id,
      type: t.type as 'BUY' | 'SELL' | 'DIVIDEND' | 'DRP',
      ticker: t.ticker,
      date: new Date(t.date),
      quantity: t.quantity,
      price: t.price,
      fees: t.fees,
      amount: t.amount,
      frankingPct: t.frankingPct,
      notes: t.notes,
    })),
  })

  return NextResponse.json({ imported: parsed.length })
}
