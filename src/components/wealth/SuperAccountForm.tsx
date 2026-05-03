'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { LabelledCurrencyInput } from '@/components/ui/CurrencyInput'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { currentSgRate } from '@/lib/superRates'

interface SuperValues {
  fundName: string
  accountNumber: string
  currentBalance: string
  employerContribPct: string
  employeeContribPct: string
  annualSalary: string
  maxConcessional: boolean
  currency: string
  notes: string
}

interface Props {
  accountId?: string
  initialValues?: Partial<SuperValues>
}

const CURRENCIES = [
  { value: 'AUD', label: 'AUD' },
  { value: 'USD', label: 'USD' },
  { value: 'NZD', label: 'NZD' },
]

const defaults: SuperValues = {
  fundName: '',
  accountNumber: '',
  currentBalance: '',
  employerContribPct: currentSgRate().toString(),
  employeeContribPct: '0',
  annualSalary: '',
  maxConcessional: false,
  currency: 'AUD',
  notes: '',
}

export function SuperAccountForm({ accountId, initialValues }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<SuperValues>({ ...defaults, ...initialValues })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = Boolean(accountId)

  function set(field: keyof SuperValues, value: string | boolean) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const salary = values.annualSalary ? parseFloat(values.annualSalary) : null

    const payload = {
      fundName: values.fundName,
      accountNumber: values.accountNumber || null,
      currentBalance: parseFloat(values.currentBalance),
      employerContribPct: parseFloat(values.employerContribPct),
      employeeContribPct: parseFloat(values.employeeContribPct),
      annualSalary: salary,
      maxConcessional: values.maxConcessional,
      currency: values.currency,
      notes: values.notes || null,
    }

    try {
      const res = await fetch(
        isEdit ? `/api/wealth/super/${accountId}` : '/api/wealth/super',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save account')
      }

      if (!isEdit) {
        setValues(defaults)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const showSalaryFields = !values.maxConcessional

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Fund Name"
          required
          placeholder="e.g. Australian Super"
          value={values.fundName}
          onChange={(e) => set('fundName', e.target.value)}
        />
        <Input
          label="Account Number (optional)"
          placeholder="e.g. 12345678"
          value={values.accountNumber}
          onChange={(e) => set('accountNumber', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LabelledCurrencyInput
          label="Current Balance"
          required
          placeholder="75,000"
          decimalScale={2}
          value={values.currentBalance}
          onChange={(v) => set('currentBalance', v)}
        />
        <Select
          label="Currency"
          options={CURRENCIES}
          value={values.currency}
          onChange={(e) => set('currency', e.target.value)}
        />
      </div>

      {/* Contributions section */}
      <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-4 space-y-4">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Contributions</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Employer SGC (%)"
            type="number"
            min="0"
            max="100"
            step="0.1"
            hint={`Super guarantee rate (currently ${currentSgRate()}%)`}
            value={values.employerContribPct}
            onChange={(e) => set('employerContribPct', e.target.value)}
          />
          <Input
            label="Employee Contribution (%)"
            type="number"
            min="0"
            max="100"
            step="0.1"
            hint="Salary sacrifice or voluntary contributions"
            value={values.employeeContribPct}
            onChange={(e) => set('employeeContribPct', e.target.value)}
          />
        </div>

        {/* Max concessional toggle */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={values.maxConcessional}
            onChange={(e) => set('maxConcessional', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700 dark:text-slate-300">
            <span className="font-medium">Maximise concessional contributions</span>
            <span className="block text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Assumes total pre-tax contributions (employer SGC + salary sacrifice) equal the
              concessional cap — $30,000 for FY2025-26, $32,500 for FY2026-27 onwards.
              Used to estimate investment performance net of contributions.
            </span>
          </span>
        </label>

        {/* Salary — only shown when not using max concessional */}
        {showSalaryFields && (
          <LabelledCurrencyInput
            label="Annual Salary (optional)"
            placeholder="100,000"
            decimalScale={0}
            value={values.annualSalary}
            onChange={(v) => set('annualSalary', v)}
          />
        )}
        {showSalaryFields && (
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Salary is used to estimate employer and employee contributions so investment
            performance can be separated from money going in.
            {values.annualSalary && values.employerContribPct ? (() => {
              const salary = parseFloat(values.annualSalary) || 0
              const emp = parseFloat(values.employerContribPct) || 0
              const ee = parseFloat(values.employeeContribPct) || 0
              const annual = salary * (emp + ee) / 100
              return annual > 0
                ? ` Estimated annual contributions: $${annual.toLocaleString('en-AU', { maximumFractionDigits: 0 })}.`
                : ''
            })() : ''}
          </p>
        )}
      </div>

      <Input
        label="Notes (optional)"
        placeholder="e.g. Balanced growth option"
        value={values.notes}
        onChange={(e) => set('notes', e.target.value)}
      />

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save Changes' : 'Add Account'}
        </Button>
      </div>
    </form>
  )
}
