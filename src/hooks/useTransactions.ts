'use client'

import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useTransactions(portfolioId?: string) {
  const url = portfolioId
    ? `/api/transactions?portfolioId=${portfolioId}`
    : '/api/transactions'

  const { data, error, isLoading, mutate } = useSWR(url, fetcher)

  async function deleteTransaction(id: string) {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    mutate()
  }

  return { transactions: data ?? [], error, isLoading, mutate, deleteTransaction }
}
