'use client'

import useSWR from 'swr'
import type { PortfolioPerformance } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function usePortfolio(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<PortfolioPerformance>(
    id ? `/api/portfolios/${id}/performance` : null,
    fetcher,
    { refreshInterval: 60000 }
  )
  return { performance: data, error, isLoading, mutate }
}
