import { NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { parseGenericEmail } from '@/lib/email/genericParser'

const SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? ''

function verifySignature(timestamp: string, token: string, signature: string): boolean {
  if (!SIGNING_KEY) return false
  const expected = createHmac('sha256', SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex')
  return expected === signature
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()

  const timestamp = formData.get('timestamp') as string ?? ''
  const token     = formData.get('token') as string ?? ''
  const signature = formData.get('signature') as string ?? ''

  // Always verify in production; allow bypass if signing key not configured (dev)
  if (SIGNING_KEY && !verifySignature(timestamp, token, signature)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Extract the import token from the recipient address
  // e.g. "abc123@import.myfi.app" → "abc123"
  const recipient = formData.get('recipient') as string ?? ''
  const importToken = recipient.split('@')[0]?.toLowerCase()
  if (!importToken) {
    return Response.json({ error: 'No recipient token' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { emailImportToken: importToken },
    select: { id: true },
  })
  if (!user) {
    // Return 200 so Mailgun doesn't retry — token just doesn't match anyone
    return Response.json({ ok: false, reason: 'unknown token' })
  }

  const sender      = formData.get('sender') as string ?? ''
  const subject     = formData.get('subject') as string ?? ''
  const bodyPlain   = formData.get('stripped-text') as string
    ?? formData.get('body-plain') as string
    ?? ''
  const bodyHtml    = formData.get('body-html') as string ?? ''
  const rawContent  = bodyPlain || bodyHtml

  const parsed = parseGenericEmail(bodyPlain, bodyHtml, sender)

  // Warn if confidence is very low — still save so nothing is silently dropped
  const warnings: string[] = [...(parsed.parseWarnings ?? [])]
  if (subject) warnings.push(`Subject: ${subject}`)

  await prisma.pendingTransaction.create({
    data: {
      source: 'mailgun',
      rawContent: rawContent.slice(0, 10000),
      fromAddress: sender || null,
      transactionType: parsed.transactionType,
      ticker: parsed.ticker,
      quantity: parsed.quantity,
      price: parsed.price,
      fees: parsed.fees,
      currency: parsed.currency ?? 'AUD',
      tradeDate: parsed.tradeDate,
      parseConfidence: parsed.parseConfidence,
      parseWarnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
      portfolioId: null,
      userId: user.id,
      status: 'PENDING',
    },
  })

  return Response.json({ ok: true })
}
