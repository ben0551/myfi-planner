import { ReactNode } from 'react'

type BadgeVariant = 'green' | 'red' | 'gray' | 'yellow' | 'blue'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClass: Record<BadgeVariant, string> = {
  green:  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  red:    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  gray:   'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  blue:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
}

export function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClass[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
