// Corporate proxy uses a self-signed cert — disable TLS verification for all outbound requests
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { SMTPServer } from 'smtp-server'
import { simpleParser } from 'mailparser'
import { parseStakeEmail } from './src/lib/email/stakeParser'
import { prisma } from './src/lib/prisma'
import { seedAdmin } from './src/lib/seed'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)
const smtpPort = parseInt(process.env.SMTP_PORT ?? '2525', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

async function main() {
  await seedAdmin()
  await app.prepare()

  // ── SMTP Server ────────────────────────────────────────────────────────────
  const smtpServer = new SMTPServer({
    authOptional: true,
    allowInsecureAuth: true,
    disabledCommands: ['STARTTLS'],
    onData(stream, _session, callback) {
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', async () => {
        try {
          const raw = Buffer.concat(chunks)
          const parsed = await simpleParser(raw)
          const result = parseStakeEmail(
            parsed.text ?? '',
            parsed.html || ''
          )

          await prisma.pendingTransaction.create({
            data: {
              source: 'email_smtp',
              rawContent: parsed.text ?? raw.toString('utf8').slice(0, 10000),
              fromAddress: parsed.from?.text ?? null,
              receivedAt: parsed.date ?? new Date(),
              transactionType: result.transactionType,
              ticker: result.ticker,
              quantity: result.quantity,
              price: result.price,
              fees: result.fees,
              currency: result.currency,
              tradeDate: result.tradeDate,
              parseConfidence: result.parseConfidence,
              parseWarnings: JSON.stringify(result.parseWarnings),
              status: 'PENDING',
            },
          })

          console.log(
            `[SMTP] Received email from ${parsed.from?.text ?? 'unknown'} — parsed ${result.ticker ?? 'unknown ticker'} (confidence: ${(result.parseConfidence * 100).toFixed(0)}%)`
          )
        } catch (err) {
          console.error('[SMTP] Failed to process email:', err)
        }
        callback()
      })
    },
  })

  smtpServer.listen(smtpPort, () => {
    console.log(`> SMTP server listening on port ${smtpPort}`)
    console.log(`  Forward broker emails to localhost:${smtpPort}`)
  })

  smtpServer.on('error', (err) => {
    console.error('[SMTP] Server error:', err)
  })

  // ── Next.js HTTP Server ────────────────────────────────────────────────────
  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  }).listen(port, () => {
    console.log(
      `> Next.js ready on http://localhost:${port} [${dev ? 'dev' : 'production'}]`
    )
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
