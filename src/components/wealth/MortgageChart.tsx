'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts'

interface Mortgage {
  originalAmount: number
  currentBalance: number
  startDate: string      // ISO date string
  termYears: number
  interestRate: number   // annual %
  repaymentAmount: number
  repaymentFreq: string  // WEEKLY | FORTNIGHTLY | MONTHLY
  loanType: string       // PI | IO
  currency: string
}

interface DataPoint {
  date: string   // YYYY-MM-DD
  scheduled: number
  actual: number | null   // only set at today's marker
  isPast: boolean
}

function monthlyPayment(freq: string, amount: number): number {
  if (freq === 'WEEKLY')      return amount * 52 / 12
  if (freq === 'FORTNIGHTLY') return amount * 26 / 12
  return amount
}

function fmtCurrency(v: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(v)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
}

function buildSchedule(m: Mortgage): DataPoint[] {
  const start = new Date(m.startDate)
  start.setDate(1) // normalise to first of month

  const endDate = new Date(start)
  endDate.setFullYear(endDate.getFullYear() + m.termYears)

  const today = new Date()
  today.setDate(1)

  const monthlyRate = m.interestRate / 100 / 12
  const payment = monthlyPayment(m.repaymentFreq, m.repaymentAmount)

  // Work out how many months from start to today
  const monthsElapsed =
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth())

  // Theoretical scheduled balance at today (from original amount)
  let scheduledBalance = m.originalAmount
  for (let i = 0; i < monthsElapsed && scheduledBalance > 0; i++) {
    if (m.loanType === 'IO') {
      // Interest only — balance stays flat
    } else {
      const interest = scheduledBalance * monthlyRate
      scheduledBalance = Math.max(0, scheduledBalance - (payment - interest))
    }
  }

  // If currentBalance differs from theoretical, we anchor future projection to currentBalance
  const projectionStart = m.currentBalance

  const points: DataPoint[] = []
  let balance = m.originalAmount

  const totalMonths = m.termYears * 12

  for (let i = 0; i <= totalMonths; i++) {
    const date = new Date(start)
    date.setMonth(date.getMonth() + i)
    const dateStr = date.toISOString().split('T')[0]
    const isPast = i <= monthsElapsed

    // For the future leg, project from actual current balance
    let plotBalance: number
    if (isPast) {
      plotBalance = balance
    } else {
      // Project forward from currentBalance
      const monthsAhead = i - monthsElapsed
      let fb = projectionStart
      for (let j = 0; j < monthsAhead && fb > 0; j++) {
        if (m.loanType === 'IO') {
          // IO: balance flat (until term ends, then full balloon)
        } else {
          const interest = fb * monthlyRate
          fb = Math.max(0, fb - (payment - interest))
        }
      }
      plotBalance = Math.round(fb)
    }

    points.push({
      date: dateStr,
      scheduled: plotBalance,
      actual: i === monthsElapsed ? m.currentBalance : null,
      isPast,
    })

    if (balance > 0) {
      if (m.loanType === 'IO') {
        // no principal reduction
      } else {
        const interest = balance * monthlyRate
        balance = Math.max(0, balance - (payment - interest))
      }
    }

    // Stop if both paths reach 0
    if (balance <= 0 && i > monthsElapsed) break
  }

  // Downsample to ~60 points to keep chart clean
  if (points.length > 60) {
    const step = Math.ceil(points.length / 60)
    const sampled = points.filter((_, i) => i % step === 0)
    // Always include the today marker and last point
    const todayPoint = points.find((p) => p.actual !== null)
    const lastPoint = points[points.length - 1]
    if (todayPoint && !sampled.includes(todayPoint)) sampled.push(todayPoint)
    if (!sampled.includes(lastPoint)) sampled.push(lastPoint)
    sampled.sort((a, b) => a.date.localeCompare(b.date))
    return sampled
  }

  return points
}

interface TooltipProps {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  currency: string
}

function CustomTooltip({ active, payload, label, currency }: TooltipProps) {
  if (!active || !payload?.length || !label) return null
  const balance = payload[0]?.value
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{fmtDate(label)}</p>
      {balance != null && (
        <p className="text-gray-800">{fmtCurrency(balance, currency)}</p>
      )}
    </div>
  )
}

export function MortgageChart({ mortgage }: { mortgage: Mortgage }) {
  const data = buildSchedule(mortgage)
  const todayPoint = data.find((p) => p.actual !== null)
  const todayDate = todayPoint?.date

  // Split into past and future series for different fill colours
  const pastData = data.map((p) => ({ ...p, future: undefined }))
  const futureData = data.map((p) => ({
    ...p,
    past: p.isPast ? p.scheduled : undefined,
    future: !p.isPast ? p.scheduled : undefined,
  }))

  const payoffDate = data[data.length - 1]
  const yearsLeft = todayPoint
    ? ((new Date(payoffDate.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)
    : null

  const totalInterest = (() => {
    if (mortgage.loanType === 'IO') return null
    const payment = monthlyPayment(mortgage.repaymentFreq, mortgage.repaymentAmount)
    const remaining = data.filter((p) => !p.isPast).length
    return Math.max(0, payment * remaining - mortgage.currentBalance)
  })()

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400">Remaining Balance</p>
          <p className="font-bold text-red-600">{fmtCurrency(mortgage.currentBalance, mortgage.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Started</p>
          <p className="font-semibold text-gray-700">{fmtDate(mortgage.startDate)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Est. Payoff</p>
          <p className="font-semibold text-gray-700">{fmtDate(payoffDate.date)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Years Remaining</p>
          <p className="font-semibold text-gray-700">{yearsLeft ?? '—'}</p>
        </div>
      </div>
      {totalInterest !== null && (
        <p className="text-xs text-gray-400">
          Est. remaining interest: <span className="font-medium text-gray-600">{fmtCurrency(totalInterest, mortgage.currency)}</span>
        </p>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradPast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6b7280" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#6b7280" stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="gradFuture" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            width={60}
          />
          <Tooltip content={<CustomTooltip currency={mortgage.currency} />} />

          {/* Today reference line */}
          {todayDate && (
            <ReferenceLine
              x={todayDate}
              stroke="#4f46e5"
              strokeDasharray="4 3"
              label={{ value: 'Today', position: 'insideTopRight', fontSize: 10, fill: '#6366f1' }}
            />
          )}

          {/* Past balance — gray */}
          <Area
            type="monotone"
            dataKey={(d: DataPoint) => d.isPast ? d.scheduled : undefined}
            name="Historical"
            stroke="#9ca3af"
            strokeWidth={2}
            fill="url(#gradPast)"
            dot={false}
            connectNulls={false}
          />

          {/* Future projection — indigo */}
          <Area
            type="monotone"
            dataKey={(d: DataPoint) => !d.isPast ? d.scheduled : undefined}
            name="Projected"
            stroke="#4f46e5"
            strokeWidth={2}
            strokeDasharray="5 4"
            fill="url(#gradFuture)"
            dot={false}
            connectNulls={false}
          />

          {/* Actual current balance dot */}
          {todayDate && todayPoint && (
            <ReferenceDot
              x={todayDate}
              y={mortgage.currentBalance}
              r={5}
              fill="#4f46e5"
              stroke="#fff"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400">
        Projection based on current balance, {mortgage.interestRate}% p.a., {mortgage.repaymentFreq.toLowerCase()} repayments of {fmtCurrency(mortgage.repaymentAmount, mortgage.currency)}.
        {mortgage.loanType === 'IO' ? ' Interest only — principal repaid at end of term.' : ''}
      </p>
    </div>
  )
}
