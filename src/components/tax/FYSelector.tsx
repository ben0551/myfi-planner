'use client'

import { useRouter } from 'next/navigation'
import { getFYLabel } from '@/lib/tax'

interface FYSelectorProps {
  availableFYs: number[]
  currentFY: number
  basePath: string  // e.g. /portfolios/[id]/tax
}

export function FYSelector({ availableFYs, currentFY, basePath }: FYSelectorProps) {
  const router = useRouter()

  // Always include the current FY even if no transactions yet
  const fys = availableFYs.includes(currentFY)
    ? availableFYs
    : [currentFY, ...availableFYs]

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-500 whitespace-nowrap">Financial Year</label>
      <select
        value={currentFY}
        onChange={(e) => router.push(`${basePath}?fy=${e.target.value}`)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {fys.map((fy) => (
          <option key={fy} value={fy}>
            {getFYLabel(fy)}
          </option>
        ))}
      </select>
    </div>
  )
}
