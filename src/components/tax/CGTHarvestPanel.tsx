'use client'

import useSWR from 'swr'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import type { HarvestResponse } from '@/app/api/tax/harvest/route'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Props {
  fyYear: number
}

export function CGTHarvestPanel({ fyYear }: Props) {
  const { data, isLoading } = useSWR<HarvestResponse>(
    `/api/tax/harvest?fy=${fyYear}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  if (isLoading) {
    return (
      <div className="h-24 flex items-center justify-center text-sm text-gray-400 dark:text-slate-500 animate-pulse">
        Checking harvest opportunities…
      </div>
    )
  }

  if (!data) return null

  const { positions, realisedNetAssessable, totalHarvestableLoss, maxOffsetAvailable, estimatedTaxSaving, currency, fyLabel } = data

  if (realisedNetAssessable <= 0) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="font-medium text-gray-900 dark:text-white text-sm">No net assessable gains this {fyLabel}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              You have no realised net capital gains to offset — tax-loss harvesting is not needed.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  if (positions.length === 0) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <span className="text-xl">📈</span>
          <div>
            <p className="font-medium text-gray-900 dark:text-white text-sm">No harvestable losses found</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              All your current holdings are at a gain — no positions available to sell for a tax loss.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
              Potential tax saving: ~{formatCurrency(estimatedTaxSaving, currency)}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              You have {formatCurrency(realisedNetAssessable, currency)} in net assessable gains this {fyLabel}.
              Selling the positions below would offset up to {formatCurrency(maxOffsetAvailable, currency)},
              saving ~{formatCurrency(estimatedTaxSaving, currency)} at a 47% marginal rate.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-amber-600 dark:text-amber-400">Total harvestable loss</p>
            <p className="font-bold text-amber-900 dark:text-amber-200">{formatCurrency(-totalHarvestableLoss, currency)}</p>
          </div>
        </div>
      </div>

      {/* Positions table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-slate-700 text-xs uppercase tracking-wide text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Ticker</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden sm:table-cell">Portfolio</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right">Avg Cost</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right">Current</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right">Cost Basis</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right">Market Value</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right">Unrealised Loss</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-right hidden md:table-cell">Est. Tax Saving</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {positions.map((p) => {
                const taxSaving = Math.abs(p.unrealisedLoss) * 0.47
                const lossFromCost = p.costBasis > 0
                  ? (p.unrealisedLoss / p.costBasis) * 100
                  : 0
                return (
                  <tr key={`${p.portfolioId}-${p.ticker}`} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900 dark:text-white">{p.ticker}</span>
                      <p className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block">{p.portfolioName}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs hidden sm:table-cell">
                      {p.portfolioName}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">
                      {p.quantity.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">
                      {formatCurrency(p.avgCost, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">
                      {formatCurrency(p.currentPrice, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400">
                      {formatCurrency(p.costBasis, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400">
                      {formatCurrency(p.currentValue, currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(p.unrealisedLoss, currency)}
                      </span>
                      <p className="text-xs text-red-400 dark:text-red-500">
                        {lossFromCost.toFixed(1)}%
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 font-medium hidden md:table-cell">
                      ~{formatCurrency(taxSaving, currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {positions.length > 1 && (
              <tfoot className="border-t-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50">
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-slate-300 hidden sm:table-cell">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(-totalHarvestableLoss, currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400 hidden md:table-cell">
                    ~{formatCurrency(estimatedTaxSaving, currency)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 dark:text-slate-500">
        Tax saving estimated at 47% marginal rate. Actual saving depends on your marginal rate and full tax position.
        Losses exceeding realised gains are carried forward to future years. Seek advice from a registered tax agent
        before selling. Australia has no statutory wash-sale rule, but the same asset or substantially identical
        assets may attract ATO scrutiny if immediately repurchased.
      </p>
    </div>
  )
}
