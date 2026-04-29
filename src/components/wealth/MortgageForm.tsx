'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { LabelledCurrencyInput } from '@/components/ui/CurrencyInput'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface MortgageValues {
  lender: string
  originalAmount: string
  currentBalance: string
  interestRate: string
  loanType: string
  repaymentAmount: string
  repaymentFreq: string
  startDate: string
  termYears: string
  notes: string
}

interface Props {
  propertyId: string
  initialValues?: Partial<MortgageValues>
  hasMortgage: boolean
}

const LOAN_TYPES = [
  { value: 'PI', label: 'Principal & Interest' },
  { value: 'IO', label: 'Interest Only' },
]

const REPAYMENT_FREQS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
]

const defaults: MortgageValues = {
  lender: '',
  originalAmount: '',
  currentBalance: '',
  interestRate: '',
  loanType: 'PI',
  repaymentAmount: '',
  repaymentFreq: 'MONTHLY',
  startDate: '',
  termYears: '30',
  notes: '',
}

export function MortgageForm({ propertyId, initialValues, hasMortgage }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<MortgageValues>({
    ...defaults,
    ...initialValues,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof MortgageValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      lender: values.lender,
      originalAmount: parseFloat(values.originalAmount),
      currentBalance: parseFloat(values.currentBalance),
      interestRate: parseFloat(values.interestRate),
      loanType: values.loanType,
      repaymentAmount: parseFloat(values.repaymentAmount),
      repaymentFreq: values.repaymentFreq,
      startDate: values.startDate,
      termYears: parseInt(values.termYears, 10),
      notes: values.notes || null,
    }

    try {
      const res = await fetch(`/api/wealth/properties/${propertyId}/mortgage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save mortgage')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Lender"
          required
          placeholder="e.g. Commonwealth Bank"
          value={values.lender}
          onChange={(e) => set('lender', e.target.value)}
        />
        <Select
          label="Loan Type"
          options={LOAN_TYPES}
          value={values.loanType}
          onChange={(e) => set('loanType', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LabelledCurrencyInput
          label="Original Loan Amount"
          required
          placeholder="400,000"
          value={values.originalAmount}
          onChange={(v) => set('originalAmount', v)}
        />
        <LabelledCurrencyInput
          label="Current Balance"
          required
          placeholder="350,000"
          value={values.currentBalance}
          onChange={(v) => set('currentBalance', v)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="Interest Rate (% p.a.)"
          type="number"
          min="0"
          max="30"
          step="0.01"
          required
          placeholder="6.50"
          value={values.interestRate}
          onChange={(e) => set('interestRate', e.target.value)}
        />
        <LabelledCurrencyInput
          label="Repayment Amount"
          required
          placeholder="2,500"
          value={values.repaymentAmount}
          onChange={(v) => set('repaymentAmount', v)}
        />
        <Select
          label="Repayment Frequency"
          options={REPAYMENT_FREQS}
          value={values.repaymentFreq}
          onChange={(e) => set('repaymentFreq', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Loan Start Date"
          type="date"
          required
          value={values.startDate}
          onChange={(e) => set('startDate', e.target.value)}
        />
        <Input
          label="Loan Term (years)"
          type="number"
          min="1"
          max="50"
          step="1"
          required
          value={values.termYears}
          onChange={(e) => set('termYears', e.target.value)}
        />
      </div>

      <Input
        label="Notes (optional)"
        placeholder="e.g. Fixed rate until Jan 2027"
        value={values.notes}
        onChange={(e) => set('notes', e.target.value)}
      />

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          {hasMortgage ? 'Update Mortgage' : 'Add Mortgage'}
        </Button>
      </div>
    </form>
  )
}
