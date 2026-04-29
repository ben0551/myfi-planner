'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface FireSettingsValues {
  annualExpenses: string
  withdrawalRate: string
  expectedReturn: string
  inflationRate: string
  superGrowthRate: string
  monthlySavings: string
  yearOfBirth: string
  targetRetireAge: string
  includeSuper: boolean
  includePropertyEquity: boolean
  includeCash: boolean
  notes: string
}

interface Props {
  initialValues?: Partial<FireSettingsValues>
}

const defaults: FireSettingsValues = {
  annualExpenses: '',
  withdrawalRate: '4.0',
  expectedReturn: '7.0',
  inflationRate: '3.0',
  superGrowthRate: '9.0',
  monthlySavings: '0',
  yearOfBirth: '',
  targetRetireAge: '',
  includeSuper: true,
  includePropertyEquity: true,
  includeCash: true,
  notes: '',
}

export function FireSettingsForm({ initialValues }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<FireSettingsValues>({
    ...defaults,
    ...initialValues,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function setStr(field: keyof FireSettingsValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  function setBool(field: keyof FireSettingsValues, value: boolean) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  // Compute current age from yearOfBirth for display
  const currentAge = values.yearOfBirth
    ? new Date().getFullYear() - parseInt(values.yearOfBirth, 10)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)

    const payload = {
      annualExpenses: parseFloat(values.annualExpenses),
      withdrawalRate: parseFloat(values.withdrawalRate),
      expectedReturn: parseFloat(values.expectedReturn),
      inflationRate: parseFloat(values.inflationRate),
      superGrowthRate: parseFloat(values.superGrowthRate || '9'),
      monthlySavings: parseFloat(values.monthlySavings || '0'),
      yearOfBirth: parseInt(values.yearOfBirth, 10),
      targetRetireAge: values.targetRetireAge ? parseInt(values.targetRetireAge, 10) : null,
      includeSuper: values.includeSuper,
      includePropertyEquity: values.includePropertyEquity,
      includeCash: values.includeCash,
      notes: values.notes || null,
    }

    try {
      const res = await fetch('/api/wealth/fire', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save settings')
      }

      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          Settings saved successfully.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Annual Expenses in Retirement ($)"
          type="number"
          min="0"
          step="100"
          required
          placeholder="80000"
          hint="How much you want to spend per year in retirement"
          value={values.annualExpenses}
          onChange={(e) => setStr('annualExpenses', e.target.value)}
        />
        <Input
          label="Monthly Savings ($)"
          type="number"
          min="0"
          step="100"
          placeholder="3000"
          hint="Net monthly amount added to investable assets (excl. super)"
          value={values.monthlySavings}
          onChange={(e) => setStr('monthlySavings', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="Withdrawal Rate (%)"
          type="number"
          min="0.1"
          max="20"
          step="0.1"
          required
          hint="Safe withdrawal rate (4% = 25x expenses)"
          value={values.withdrawalRate}
          onChange={(e) => setStr('withdrawalRate', e.target.value)}
        />
        <Input
          label="Portfolio Return (%)"
          type="number"
          min="0"
          max="30"
          step="0.1"
          required
          hint="Nominal annual return on investable assets"
          value={values.expectedReturn}
          onChange={(e) => setStr('expectedReturn', e.target.value)}
        />
        <Input
          label="Inflation Rate (%)"
          type="number"
          min="0"
          max="20"
          step="0.1"
          required
          hint="Annual inflation assumption"
          value={values.inflationRate}
          onChange={(e) => setStr('inflationRate', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="Super Growth Rate (%)"
          type="number"
          min="0"
          max="30"
          step="0.1"
          hint="Combined contributions + investment return (typically 8–10%)"
          value={values.superGrowthRate}
          onChange={(e) => setStr('superGrowthRate', e.target.value)}
        />
        <div>
          <Input
            label="Year of Birth"
            type="number"
            min="1920"
            max={new Date().getFullYear() - 18}
            step="1"
            required
            placeholder="1985"
            hint={currentAge !== null && !isNaN(currentAge) ? `Current age: ${currentAge}` : 'Set once — age auto-updates each year'}
            value={values.yearOfBirth}
            onChange={(e) => setStr('yearOfBirth', e.target.value)}
          />
        </div>
        <Input
          label="Target Retirement Age (optional)"
          type="number"
          min="18"
          max="100"
          step="1"
          placeholder="60"
          hint="See projected NW at this age vs FIRE number"
          value={values.targetRetireAge}
          onChange={(e) => setStr('targetRetireAge', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Include in investable net worth:</p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={values.includeSuper}
              onChange={(e) => setBool('includeSuper', e.target.checked)}
            />
            Super / Pension
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={values.includePropertyEquity}
              onChange={(e) => setBool('includePropertyEquity', e.target.checked)}
            />
            Property Equity
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={values.includeCash}
              onChange={(e) => setBool('includeCash', e.target.checked)}
            />
            Cash
          </label>
        </div>
      </div>

      <Input
        label="Notes (optional)"
        placeholder="Any notes about your FIRE plan"
        value={values.notes}
        onChange={(e) => setStr('notes', e.target.value)}
      />

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Save Settings
        </Button>
      </div>
    </form>
  )
}
