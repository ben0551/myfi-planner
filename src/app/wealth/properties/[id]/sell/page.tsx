'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { LabelledCurrencyInput } from '@/components/ui/CurrencyInput'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface PropertyData {
  id: string
  name: string
  type: string
  purchasePrice: number
  purchaseDate: string
  currentValue: number
  currency: string
  mortgage: {
    currentBalance: number
    lender: string
  } | null
}

interface CashAccount {
  id: string
  name: string
  institution: string | null
  balance: number
}

function calcCGT(
  salePrice: number,
  costBase: number,
  purchaseDate: string,
  soldDate: string
): { grossGain: number; discountedGain: number; cgtDiscount: boolean } {
  const grossGain = salePrice - costBase
  const held = (new Date(soldDate).getTime() - new Date(purchaseDate).getTime()) / (86400000 * 365)
  const cgtDiscount = held >= 1 && grossGain > 0
  const discountedGain = cgtDiscount ? grossGain * 0.5 : grossGain
  return { grossGain, discountedGain, cgtDiscount }
}

export default function PropertySellPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const propertyId = params.id

  const [property, setProperty] = useState<PropertyData | null>(null)
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [loading, setLoading] = useState(true)

  const [salePrice, setSalePrice] = useState('')
  const [soldDate, setSoldDate] = useState(new Date().toISOString().split('T')[0])
  const [mortgagePayout, setMortgagePayout] = useState('')
  const [cashAccountId, setCashAccountId] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [costBase, setCostBase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/wealth/properties/${propertyId}`).then((r) => r.json()),
      fetch('/api/wealth/cash').then((r) => r.json()),
    ]).then(([prop, cash]) => {
      setProperty(prop)
      setCashAccounts(Array.isArray(cash) ? cash : [])
      if (prop?.currentValue) setSalePrice(String(prop.currentValue))
      if (prop?.mortgage?.currentBalance) setMortgagePayout(String(prop.mortgage.currentBalance))
      if (prop?.purchasePrice) setCostBase(String(prop.purchasePrice))
      setLoading(false)
    })
  }, [propertyId])

  // Auto-compute net cash proceeds
  const salePriceNum = parseFloat(salePrice.replace(/,/g, '')) || 0
  const mortgagePayoutNum = parseFloat(mortgagePayout.replace(/,/g, '')) || 0
  const netProceeds = salePriceNum - mortgagePayoutNum

  useEffect(() => {
    if (netProceeds > 0) setCashAmount(String(netProceeds.toFixed(2)))
  }, [netProceeds])

  const isInvestment = property?.type === 'INVESTMENT'
  const costBaseNum = parseFloat(costBase.replace(/,/g, '')) || 0
  const cgtCalc = isInvestment && salePriceNum > 0 && costBaseNum > 0
    ? calcCGT(salePriceNum, costBaseNum, property!.purchaseDate, soldDate)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!salePrice) { setError('Sale price is required'); return }
    if (!soldDate) { setError('Settlement date is required'); return }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/wealth/properties/${propertyId}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salePrice: salePriceNum,
          soldDate,
          mortgagePayout: mortgagePayoutNum > 0 ? mortgagePayoutNum : undefined,
          cashAccountId: cashAccountId || undefined,
          cashAmount: cashAmount ? parseFloat(cashAmount.replace(/,/g, '')) : undefined,
          costBase: isInvestment && costBaseNum > 0 ? costBaseNum : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to record sale')
        return
      }
      router.push('/wealth')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-10 text-center">Loading…</div>
  }

  if (!property) {
    return <div className="text-sm text-red-500 py-10 text-center">Property not found.</div>
  }

  const cashOptions = [
    { value: '', label: 'Do not deposit proceeds' },
    ...cashAccounts.map((a) => ({
      value: a.id,
      label: `${a.name}${a.institution ? ` (${a.institution})` : ''}`,
    })),
  ]

  return (
    <div className="max-w-xl space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <Link href="/wealth" className="hover:text-indigo-600">Wealth</Link>
        {' / '}
        <Link href={`/wealth/properties/${propertyId}`} className="hover:text-indigo-600">{property.name}</Link>
        {' / Sell'}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sell Property</h1>
        <p className="text-sm text-gray-500 mt-1">{property.name} · {property.type}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Sale Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <LabelledCurrencyInput
              label="Sale Price ($)"
              value={salePrice}
              onChange={(v) => setSalePrice(v)}
              placeholder="e.g. 850,000"
            />
            <Input
              label="Settlement Date"
              type="date"
              value={soldDate}
              onChange={(e) => setSoldDate(e.target.value)}
            />
          </div>
        </div>

        {/* Mortgage payout */}
        {property.mortgage && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Loan Payout</h2>
            <p className="text-xs text-gray-500">
              Current mortgage balance: <span className="font-medium">${property.mortgage.currentBalance.toLocaleString()}</span> with {property.mortgage.lender}
            </p>
            <LabelledCurrencyInput
              label="Payout Amount ($)"
              value={mortgagePayout}
              onChange={(v) => setMortgagePayout(v)}
              placeholder={String(property.mortgage.currentBalance)}
              hint="The mortgage will be cleared to zero after this payout"
            />
          </div>
        )}

        {/* Cash proceeds */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Cash Proceeds</h2>
          {salePriceNum > 0 && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              Net proceeds: <span className="font-semibold">${netProceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              {' '}(sale ${salePriceNum.toLocaleString()}
              {mortgagePayoutNum > 0 ? ` − mortgage $${mortgagePayoutNum.toLocaleString()}` : ''})
            </div>
          )}
          <Select
            label="Deposit proceeds into"
            value={cashAccountId}
            onChange={(e) => setCashAccountId(e.target.value)}
            options={cashOptions}
          />
          {cashAccountId && (
            <LabelledCurrencyInput
              label="Cash Amount ($)"
              value={cashAmount}
              onChange={(v) => setCashAmount(v)}
              placeholder="0.00"
              hint="This will be added to the selected account balance"
            />
          )}
        </div>

        {/* CGT calculation — INVESTMENT only */}
        {isInvestment && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-amber-800">CGT Calculation (Investment Property)</h2>
            <LabelledCurrencyInput
              label="Cost Base ($)"
              value={costBase}
              onChange={(v) => setCostBase(v)}
              placeholder={String(property.purchasePrice)}
              hint="Purchase price + stamp duty + legal fees + capital improvements − depreciation claimed"
            />
            {cgtCalc && (
              <div className="bg-white rounded-lg border border-amber-100 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Gross capital gain</span>
                  <span className={`font-medium ${cgtCalc.grossGain >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    ${cgtCalc.grossGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {cgtCalc.cgtDiscount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">50% CGT discount (held &gt;12 months)</span>
                    <span className="text-gray-500">−${(cgtCalc.grossGain * 0.5).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-100 pt-1.5 font-semibold">
                  <span className="text-gray-700">Assessable capital gain</span>
                  <span className={cgtCalc.discountedGain >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                    ${cgtCalc.discountedGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  This is a rough estimate. Consult a tax professional — other factors (main residence exemption, depreciation, negative gearing) may apply.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={submitting} variant="danger">
            Confirm Sale
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
