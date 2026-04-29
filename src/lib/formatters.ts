export function formatCurrency(
  value: number | null | undefined,
  currency = 'AUD',
  compact = false
): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value)
}

export function formatPercent(
  value: number | null | undefined,
  digits = 2
): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function formatNumber(
  value: number | null | undefined,
  digits = 2
): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatDate(
  date: Date | string | null | undefined,
  style: 'short' | 'medium' | 'long' = 'medium'
): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (style === 'short') {
    return d.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }
  if (style === 'long') {
    return d.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function gainClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return 'text-gray-500'
  return value > 0 ? 'text-green-600' : 'text-red-600'
}
