'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useRef, useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { NotificationBell } from '@/components/alerts/NotificationBell'
import { useColorTheme } from '@/components/ui/ColorThemeProvider'

// Invest: portfolio-facing pages
const investItems = [
  { href: '/portfolios', label: 'Portfolios', icon: '📊' },
  { href: '/watchlist', label: 'Watchlist', icon: '👁' },
  { href: '/screener', label: 'Screener', icon: '🔎' },
  { href: '/income', label: 'Income', icon: '💰' },
  { href: '/transactions', label: 'Transactions', icon: '🔍' },
]

// Money: wealth and budget pages (household added conditionally)
const moneyItemsBase = [
  { href: '/wealth', label: 'Wealth', icon: '🏦' },
  { href: '/budget', label: 'Budget', icon: '📋' },
  { href: '/bank-import', label: 'Bank Import', icon: '📥' },
]
const householdItem = { href: '/household', label: 'Household', icon: '🏠' }

// Reports: cross-portfolio tax and performance reports
const reportItems = [
  { href: '/reports/tax/cgt', label: 'Capital Gains', icon: '📊' },
  { href: '/reports/tax/income', label: 'Tax Income', icon: '💵' },
  { href: '/reports/tax/all-trades', label: 'All Trades', icon: '📋' },
  { href: '/reports/performance', label: 'Performance', icon: '📈' },
  { href: '/tax', label: 'Tax Summary', icon: '🧾' },
]

const leftItems = [
  { href: '/', label: 'Dashboard' },
]

const rightItems = [
  { href: '/research', label: 'Research' },
]

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onClose])
}

function NavDropdown({ label, items, pathname }: {
  label: string
  items: { href: string; label: string; icon: string }[]
  pathname: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const isActive = items.some((i) => pathname.startsWith(i.href))

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
            : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200'
        }`}
      >
        {label}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-11 w-44 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 z-50">
          {items.map((item) => {
            const itemActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors ${
                  itemActive
                    ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function InlineThemeControls() {
  const { resolvedTheme, setTheme } = useTheme()
  const { themes, themeId, setThemeId } = useColorTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const isDark = resolvedTheme === 'dark'

  return (
    <div className="px-3.5 py-2.5 border-t border-gray-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wide">Appearance</span>
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={`relative w-9 h-5 rounded-full transition-colors ${isDark ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-slate-600'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setThemeId(t.id)}
            title={t.name}
            className="w-5 h-5 rounded-full transition-transform hover:scale-110"
            style={{
              backgroundColor: t.swatch,
              outline: t.id === themeId ? `2px solid ${t.swatch}` : '2px solid transparent',
              outlineOffset: '2px',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function UserDropdown({ session, isAdmin, hasHousehold }: {
  session: { user: { name?: string | null; email?: string | null } }
  isAdmin: boolean
  hasHousehold: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const displayName = session.user.name ?? session.user.email ?? 'Account'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center hover:bg-indigo-200 dark:hover:bg-indigo-800/60 transition-colors"
        title={displayName}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 z-50">
          {/* User info header */}
          <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-slate-700">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{displayName}</p>
            {isAdmin && <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">Admin</p>}
          </div>

          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>

            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Alerts
            </Link>

            {!hasHousehold && (
              <Link
                href="/household"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Household
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin/users"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin
              </Link>
            )}
          </div>

          {/* Theme controls */}
          <InlineThemeControls />

          <div className="border-t border-gray-100 dark:border-slate-700 pt-1">
            <button
              onClick={() => { setOpen(false); signOut({ callbackUrl: '/login' }) }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors text-left"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MobileMenu({ pathname, hasHousehold }: { pathname: string; hasHousehold: boolean }) {
  const [open, setOpen] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const moneyItems = hasHousehold
    ? [householdItem, ...moneyItemsBase]
    : moneyItemsBase

  const groups = [
    { label: 'Invest', items: investItems },
    { label: 'Money', items: moneyItems },
    { label: 'Reports', items: reportItems },
  ]

  function handleOpen() {
    const next = !open
    setOpen(next)
    if (next) {
      // auto-expand the group containing the current page
      const active = groups.find((g) => g.items.some((i) => pathname.startsWith(i.href)))
      setExpandedGroup(active?.label ?? null)
    }
  }

  return (
    <div ref={ref} className="md:hidden relative">
      <button
        onClick={handleOpen}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Menu"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-60 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden max-h-[80vh] overflow-y-auto">
          {/* Dashboard */}
          <div className="py-1">
            {leftItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40'
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className="border-t border-gray-100 dark:border-slate-700">
            {groups.map((group) => {
              const isExpanded = expandedGroup === group.label
              const isGroupActive = group.items.some((i) => pathname.startsWith(i.href))

              return (
                <div key={group.label}>
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      isGroupActive && !isExpanded
                        ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/30'
                        : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <span>{group.label}</span>
                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="bg-gray-50 dark:bg-slate-700/30 border-t border-b border-gray-100 dark:border-slate-700/50">
                      {group.items.map((item) => {
                        const active = pathname.startsWith(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={`flex items-center gap-2.5 pl-6 pr-3.5 py-2.5 text-sm transition-colors ${
                              active
                                ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40'
                                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100/70 dark:hover:bg-slate-700/50'
                            }`}
                          >
                            <span className="text-base">{item.icon}</span>
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Research */}
          <div className="border-t border-gray-100 dark:border-slate-700 py-1">
            {rightItems.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40'
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function Navbar({ hasHousehold }: { hasHousehold: boolean }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const moneyItems = hasHousehold
    ? [householdItem, ...moneyItemsBase]
    : moneyItemsBase

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Left: logo + nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="text-indigo-600 font-bold text-lg">💹</span>
              <span className="font-bold text-gray-900 dark:text-white text-lg">MyFiPlanner</span>
            </Link>

            <div className="hidden md:flex items-center gap-0.5">
              {leftItems.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <NavDropdown label="Invest" items={investItems} pathname={pathname} />
              <NavDropdown label="Money" items={moneyItems} pathname={pathname} />
              <NavDropdown label="Reports" items={reportItems} pathname={pathname} />
              {rightItems.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right: bell + user + mobile hamburger */}
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            {session?.user && (
              <UserDropdown session={session} isAdmin={isAdmin} hasHousehold={hasHousehold} />
            )}
            <MobileMenu pathname={pathname} hasHousehold={hasHousehold} />
          </div>

        </div>
      </div>
    </nav>
  )
}
