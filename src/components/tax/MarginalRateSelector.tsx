'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const RATES = [
  { label: '34.5%', value: 34.5, note: '$45k–$120k + 2% Medicare' },
  { label: '39%',   value: 39,   note: '$120k–$135k + 2% Medicare' },
  { label: '47%',   value: 47,   note: '$135k–$190k + 2% Medicare' },
  { label: '49%',   value: 49,   note: '$190k+ + 2% Medicare' },
]

export function MarginalRateSelector({ currentRate }: { currentRate: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setRate(rate: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('rate', String(rate))
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500">Marginal rate:</span>
      {RATES.map((r) => (
        <button
          key={r.value}
          onClick={() => setRate(r.value)}
          title={r.note}
          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
            currentRate === r.value
              ? 'bg-amber-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
