import { parseStakeEmail } from './stakeParser'
import type { ParsedTransaction } from './types'

// Generic parser delegates to Stake parser which uses broad heuristic patterns
// Add more broker-specific parsers here as needed
export function parseGenericEmail(
  text: string,
  html = '',
  fromAddress = ''
): ParsedTransaction {
  return parseStakeEmail(text, html)
}
