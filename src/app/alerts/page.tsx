'use client'

import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Card } from '@/components/ui/Card'
import { AlertForm } from '@/components/alerts/AlertForm'
import { AlertCard } from '@/components/alerts/AlertCard'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AlertsPage() {
  const { data: alertsData, mutate } = useSWR('/api/alerts', fetcher, {
    refreshInterval: 30000,
  })
  const alerts = Array.isArray(alertsData) ? alertsData : []
  const { data: portfolios = [] } = useSWR('/api/portfolios', fetcher)

  async function handleDelete(id: string) {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
    mutate()
  }

  async function handleReset(id: string) {
    await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isTriggered: false }),
    })
    mutate()
  }

  const active = alerts.filter((a: { isTriggered: boolean }) => !a.isTriggered)
  const triggered = alerts.filter((a: { isTriggered: boolean }) => a.isTriggered)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Price Alerts</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">New Alert</h2>
            <AlertForm portfolios={portfolios} onCreated={mutate} />
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {active.length > 0 && (
            <div>
              <h2 className="font-medium text-gray-700 mb-3">
                Active ({active.length})
              </h2>
              <div className="space-y-2">
                {active.map((alert: Parameters<typeof AlertCard>[0]['alert']) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onDelete={handleDelete}
                    onReset={handleReset}
                  />
                ))}
              </div>
            </div>
          )}

          {triggered.length > 0 && (
            <div>
              <h2 className="font-medium text-gray-700 mb-3">
                Triggered ({triggered.length})
              </h2>
              <div className="space-y-2">
                {triggered.map((alert: Parameters<typeof AlertCard>[0]['alert']) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onDelete={handleDelete}
                    onReset={handleReset}
                  />
                ))}
              </div>
            </div>
          )}

          {alerts.length === 0 && (
            <Card className="text-center py-12 text-gray-500">
              <p className="font-medium">No alerts yet</p>
              <p className="text-sm mt-1">Create an alert to be notified when a stock hits your target price.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
