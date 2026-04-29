import { parseStakeEmail } from './stakeParser'
import type { ParsedTransaction } from './types'

export async function parseEmlBuffer(buffer: Buffer): Promise<ParsedTransaction> {
  // Dynamically import mailparser to avoid issues at build time
  const { simpleParser } = await import('mailparser')
  const parsed = await simpleParser(buffer)
  return parseStakeEmail(parsed.text ?? '', parsed.html || '')
}
