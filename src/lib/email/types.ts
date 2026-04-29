export type ParsedTransactionType = 'BUY' | 'SELL' | 'DIVIDEND'

export interface ParsedTransaction {
  transactionType: ParsedTransactionType | null
  ticker: string | null
  quantity: number | null
  price: number | null
  fees: number | null
  currency: string
  tradeDate: Date | null
  parseConfidence: number
  parseWarnings: string[]
}

export function emptyParsed(): ParsedTransaction {
  return {
    transactionType: null,
    ticker: null,
    quantity: null,
    price: null,
    fees: null,
    currency: 'AUD',
    tradeDate: null,
    parseConfidence: 0,
    parseWarnings: ['No recognisable transaction data found'],
  }
}
