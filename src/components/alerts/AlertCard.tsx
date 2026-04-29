'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/formatters'

interface PriceAlert {
  id: string
  ticker: string
  targetPrice: number
  direction: string
  note: string | null
  isTriggered: boolean
  triggeredAt: string | null
  triggeredPrice: number | null
  portfolio: { name: string } | null
}

interface AlertCardProps {
  alert: PriceAlert
  onDelete: (id: string) => void
  onReset: (id: string) => void
}

export function AlertCard({ alert, onDelete, onReset }: AlertCardProps) {
  const dirSymbol = alert.direction === 'ABOVE' ? '↑' : '↓'

  return (
    <div
      className={`border rounded-lg p-4 ${
        alert.isTriggered
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{alert.ticker}</span>
            <span className="text-gray-500 text-sm">
              {dirSymbol} {formatCurrency(alert.targetPrice)}
            </span>
            {alert.isTriggered && (
              <Badge variant="green">Triggered</Badge>
            )}
          </div>
          {alert.note && (
            <p className="text-xs text-gray-600">{alert.note}</p>
          )}
          {alert.portfolio && (
            <p className="text-xs text-gray-400">Portfolio: {alert.portfolio.name}</p>
          )}
          {alert.isTriggered && alert.triggeredAt && (
            <p className="text-xs text-green-700">
              Hit {formatCurrency(alert.triggeredPrice)} on {formatDate(alert.triggeredAt)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {alert.isTriggered && (
            <Button size="sm" variant="secondary" onClick={() => onReset(alert.id)}>
              Reset
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={() => onDelete(alert.id)}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
