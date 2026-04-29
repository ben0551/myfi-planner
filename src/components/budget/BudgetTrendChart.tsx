'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
function fmt(v: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', maximumFractionDigits: 0,
  }).format(v)
}

interface TrendPoint {
  year: number
  month: number
  totalBudgeted: number
  totalActual: number
}

export function BudgetTrendChart() {
  const [data, setData] = useState<TrendPoint[]>([])

  useEffect(() => {
    fetch('/api/budget/summary?months=12')
      .then((r) => r.json())
      .then(setData)
  }, [])

  const chartData = data.map((d) => ({
    label: new Date(d.year, d.month - 1, 1).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
    Budgeted: d.totalBudgeted,
    Actual: d.totalActual,
  }))

  if (chartData.every((d) => d.Budgeted === 0 && d.Actual === 0)) {
    return <p className="text-sm text-gray-400 text-center py-8">No trend data yet</p>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} width={64} />
        <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Budgeted" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={20} />
        <Bar dataKey="Actual" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}
