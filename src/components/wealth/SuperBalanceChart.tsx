'use client'

// Re-export AssetValueChart pre-configured for super accounts
import { AssetValueChart, type ValuePoint } from './AssetValueChart'

interface Props {
  history: ValuePoint[]
  currency?: string
}

export function SuperBalanceChart({ history, currency = 'AUD' }: Props) {
  return (
    <AssetValueChart
      history={history}
      currency={currency}
      color="#d97706"
      fillId="gradSuper"
      valueLabel="Super Balance"
    />
  )
}
