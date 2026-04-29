'use client'

import useSWR from 'swr'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

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

const fetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : null))

export function useAlerts() {
  const lastCheckRef = useRef<string>(new Date().toISOString())

  const { data: allAlertsRaw } = useSWR<PriceAlert[] | null>(
    '/api/alerts',
    fetcher,
    { refreshInterval: 30000 }
  )
  const allAlerts: PriceAlert[] = Array.isArray(allAlertsRaw) ? allAlertsRaw : []

  const { data: newlyTriggeredRaw } = useSWR<PriceAlert[] | null>(
    () => `/api/alerts?triggered=true&since=${lastCheckRef.current}`,
    fetcher,
    { refreshInterval: 30000 }
  )
  const newlyTriggered: PriceAlert[] = Array.isArray(newlyTriggeredRaw) ? newlyTriggeredRaw : []

  useEffect(() => {
    if (newlyTriggered.length > 0) {
      newlyTriggered.forEach((alert) => {
        const dir = alert.direction === 'ABOVE' ? '↑' : '↓'
        toast.success(
          `${dir} ${alert.ticker} hit $${alert.triggeredPrice?.toFixed(2)}`,
          {
            description:
              alert.note ??
              `Target: $${alert.targetPrice.toFixed(2)} ${alert.direction.toLowerCase()}`,
            duration: 8000,
          }
        )

        // Browser notification (if permission granted)
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          new Notification(`Price Alert: ${alert.ticker}`, {
            body: `${dir} Hit $${alert.triggeredPrice?.toFixed(2)} (target: $${alert.targetPrice.toFixed(2)})`,
          })
        }
      })
      lastCheckRef.current = new Date().toISOString()
    }
  }, [newlyTriggered])

  const unreadCount = allAlerts.filter(
    (a) =>
      a.isTriggered &&
      a.triggeredAt &&
      new Date(a.triggeredAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length

  return { allAlerts, unreadCount }
}
