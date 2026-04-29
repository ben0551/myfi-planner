'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { AllocationDonutChart } from './AllocationDonutChart'
import { RiskCompositionChart } from './RiskCompositionChart'
import { BenchmarkChart } from './BenchmarkChart'
import { formatCurrency } from '@/lib/formatters'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const BENCHMARKS = [
  { key: 'ASX200', label: 'ASX 200' },
  { key: 'ALORDS', label: 'All Ords' },
  { key: 'SP500', label: 'S&P 500' },
]

interface AnalysisData {
  totalValue: number
  currency: string
  sectors: { name: string; value: number; pct: number }[]
  regions: { name: string; value: number; pct: number }[]
  risk: { name: string; value: number; pct: number }[]
  holdingsWithProfile: {
    ticker: string
    currentValue: number
    pct: number
    isEtf: boolean
    etfName: string | null
    instrumentType: string | null
    riskCategory: string | null
    hasManualClassification: boolean
    sectorWeights: { sector: string; pct: number }[]
    regionWeights: { country: string; pct: number }[]
    sector: string | null
    country: string | null
    beta: number | null
  }[]
  benchmarkSeries: { date: string; portfolio: number; benchmark: number }[]
  benchmarkLabel: string
}

interface Props {
  portfolioId: string
  currency: string
}

export function AnalysisDashboard({ portfolioId, currency }: Props) {
  const [benchmark, setBenchmark] = useState('ASX200')

  const { data, error, isLoading } = useSWR<AnalysisData>(
    `/api/portfolios/${portfolioId}/analysis?benchmark=${benchmark}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
      Failed to load analysis data.
    </div>
  )

  if (isLoading || !data) return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-64 animate-pulse">
          <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
          <div className="h-40 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  )

  const portfolioAvgBeta = data.holdingsWithProfile
    .filter((h) => h.beta != null)
    .reduce((sum, h, _, arr) => sum + (h.beta! * h.pct) / 100 / arr.length * arr.length, 0)

  const weightedBeta = data.holdingsWithProfile
    .filter((h) => h.beta != null)
    .reduce((sum, h) => sum + h.beta! * (h.pct / 100), 0)

  return (
    <div className="space-y-6">
      {/* Note about data */}
      <div className="flex gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
        <span className="shrink-0">ℹ</span>
        <span>
          Click <strong>Classify</strong> on any holding to manually set its instrument type, sectors, and regions —
          manual classifications take priority over auto-detected data. ETFs with look-through weights are distributed
          proportionally across the charts.
        </span>
      </div>

      {/* Composition row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Sector Allocation</h2>
          <AllocationDonutChart
            data={data.sectors}
            currency={currency}
            emptyMessage="No sector data — prices may still be loading."
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Geographic Exposure</h2>
          <AllocationDonutChart
            data={data.regions}
            currency={currency}
            emptyMessage="No country data available."
          />
        </div>
      </div>

      {/* Risk composition */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Risk Composition</h2>
            <p className="text-xs text-gray-400 mt-0.5">Based on beta relative to market</p>
          </div>
          {weightedBeta > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Portfolio Beta</p>
              <p className="text-lg font-bold text-gray-900">{weightedBeta.toFixed(2)}</p>
            </div>
          )}
        </div>
        <RiskCompositionChart data={data.risk} currency={currency} />
      </div>

      {/* Benchmark comparison */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Benchmark Comparison</h2>
            <p className="text-xs text-gray-400 mt-0.5">Total return (%) from first snapshot — indexed to 0%</p>
          </div>
          <div className="flex gap-1">
            {BENCHMARKS.map((b) => (
              <button
                key={b.key}
                onClick={() => setBenchmark(b.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  benchmark === b.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <BenchmarkChart data={data.benchmarkSeries} benchmarkLabel={BENCHMARKS.find((b) => b.key === benchmark)?.label ?? benchmark} />
      </div>

      {/* Holdings detail table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">Holdings Detail</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 font-medium">Ticker</th>
                <th className="px-4 py-3 font-medium text-right">Value</th>
                <th className="px-4 py-3 font-medium text-right">Weight</th>
                <th className="px-4 py-3 font-medium">Sectors</th>
                <th className="px-4 py-3 font-medium">Regions</th>
                <th className="px-4 py-3 font-medium text-right">Beta</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.holdingsWithProfile.map((h) => (
                <tr key={h.ticker} className="hover:bg-gray-50 align-top">
                  <td className="px-6 py-3">
                    <div className="font-semibold text-gray-900">{h.ticker}</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {h.instrumentType && (
                        <span className="text-xs rounded-full bg-indigo-50 text-indigo-600 px-1.5 py-0.5">
                          {h.instrumentType}
                        </span>
                      )}
                      {h.riskCategory && (
                        <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                          h.riskCategory === 'LOW' ? 'bg-emerald-50 text-emerald-700' :
                          h.riskCategory === 'HIGH' ? 'bg-red-50 text-red-600' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {h.riskCategory}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(h.currentValue, currency)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{h.pct.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    {h.sectorWeights.length > 0 ? (
                      <div className="space-y-0.5">
                        {h.sectorWeights.slice(0, 4).map((sw) => (
                          <div key={sw.sector} className="flex items-center gap-2 text-xs">
                            <div className="w-12 bg-gray-100 rounded-full h-1 shrink-0">
                              <div className="bg-indigo-400 h-1 rounded-full" style={{ width: `${Math.min(100, sw.pct)}%` }} />
                            </div>
                            <span className="text-gray-500 truncate">{sw.sector}</span>
                            <span className="text-gray-400 ml-auto shrink-0">{sw.pct.toFixed(0)}%</span>
                          </div>
                        ))}
                        {h.sectorWeights.length > 4 && (
                          <span className="text-xs text-gray-400">+{h.sectorWeights.length - 4} more</span>
                        )}
                      </div>
                    ) : h.sector ? (
                      <span className="text-sm text-gray-600">{h.sector}</span>
                    ) : (
                      <span className="text-gray-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {h.regionWeights.length > 0 ? (
                      <div className="space-y-0.5">
                        {h.regionWeights.slice(0, 3).map((rw) => (
                          <div key={rw.country} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-600 truncate">{rw.country}</span>
                            <span className="text-gray-400 ml-auto shrink-0">{rw.pct.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    ) : h.country ? (
                      <span className="text-sm text-gray-600">{h.country}</span>
                    ) : (
                      <span className="text-gray-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 text-sm">
                    {h.beta != null ? h.beta.toFixed(2) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/tickers/${h.ticker}?back=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}
                      className={`text-xs whitespace-nowrap ${h.hasManualClassification ? 'text-indigo-500 hover:text-indigo-700' : 'text-gray-400 hover:text-indigo-500'}`}
                    >
                      {h.hasManualClassification ? 'Edit →' : 'Classify'}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
