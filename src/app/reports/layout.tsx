'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Card } from '@/components/ui/Card'

const taxLinks = [
  { href: '/reports/tax/cgt', label: 'Capital Gains' },
  { href: '/reports/tax/income', label: 'Taxable Income' },
  { href: '/reports/tax/all-trades', label: 'All Trades' },
]

const perfLinks = [
  { href: '/reports/performance', label: 'Portfolio Performance' },
]

function SidebarLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium'
          : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-200'
      }`}
    >
      {label}
    </Link>
  )
}

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6 items-start">
      {/* Sidebar */}
      <div className="hidden md:block w-48 shrink-0">
        <Card padding={false} className="p-3 space-y-4">
          <div>
            <p className="px-3 pb-1 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
              Tax
            </p>
            <div className="space-y-0.5">
              {taxLinks.map((l) => (
                <SidebarLink key={l.href} href={l.href} label={l.label} />
              ))}
            </div>
          </div>
          <div>
            <p className="px-3 pb-1 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
              Performance
            </p>
            <div className="space-y-0.5">
              {perfLinks.map((l) => (
                <SidebarLink key={l.href} href={l.href} label={l.label} />
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
