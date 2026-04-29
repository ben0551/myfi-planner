'use client'

import { NumericFormat } from 'react-number-format'

const inputClass =
  'block w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

// Standalone input styling (used inside budget table rows etc.)
const baseClass =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

interface BaseProps {
  placeholder?: string
  className?: string
  allowNegative?: boolean
  required?: boolean
  id?: string
  decimalScale?: number
}

// String-based onChange — compatible with existing form state (string fields)
interface StringProps extends BaseProps {
  value: string
  onChange: (value: string) => void
  onNumberChange?: never
}

// Number-based onChange — for forms that store monetary values as numbers
interface NumberProps extends BaseProps {
  value: number
  onNumberChange: (value: number) => void
  onChange?: never
}

type Props = StringProps | NumberProps

export function CurrencyInput({
  value,
  placeholder = '0',
  className,
  allowNegative = false,
  required,
  id,
  decimalScale = 2,
  ...rest
}: Props) {
  return (
    <NumericFormat
      id={id}
      value={value === 0 || value === '' ? '' : value}
      onValueChange={(v) => {
        if ('onNumberChange' in rest && rest.onNumberChange) {
          rest.onNumberChange(v.floatValue ?? 0)
        } else if ('onChange' in rest && rest.onChange) {
          rest.onChange(v.value) // raw string without commas, e.g. "100000"
        }
      }}
      thousandSeparator=","
      decimalScale={decimalScale}
      allowNegative={allowNegative}
      placeholder={placeholder}
      required={required}
      className={className ?? baseClass}
    />
  )
}

// Labelled wrapper matching the Input component's label/hint styling
interface LabelledProps {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  allowNegative?: boolean
  decimalScale?: number
}

export function LabelledCurrencyInput({ label, hint, value, onChange, placeholder, required, allowNegative, decimalScale }: LabelledProps) {
  const id = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-slate-300">
        {label}
      </label>
      <NumericFormat
        id={id}
        value={value === '' || value === '0' ? '' : value}
        onValueChange={(v) => onChange(v.value)}
        thousandSeparator=","
        decimalScale={decimalScale ?? 2}
        allowNegative={allowNegative ?? false}
        placeholder={placeholder ?? '0'}
        required={required}
        className={inputClass}
      />
      {hint && <p className="text-xs text-gray-500 dark:text-slate-400">{hint}</p>}
    </div>
  )
}
