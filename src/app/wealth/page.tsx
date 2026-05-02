import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/formatters'
import { computeNetWorth, WealthSnapshot } from '@/lib/wealth'
import { NetWorthHistoryChart } from '@/components/wealth/NetWorthHistoryChart'
import { recordNetWorthSnapshot } from '@/lib/netWorthSnapshot'

export const dynamic = 'force-dynamic'

export default async function WealthPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id

  const [properties, superAccounts, cashAccounts, fireSettings, portfolios, inheritances, allGoals] = await Promise.all([
    prisma.property.findMany({ where: { userId, soldDate: null }, include: { mortgage: true }, orderBy: { name: 'asc' } }),
    prisma.superAccount.findMany({ where: { userId }, orderBy: { fundName: 'asc' } }),
    prisma.cashAccount.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.fireSettings.findUnique({ where: { userId } }),
    prisma.portfolio.findMany({ where: { userId }, select: { id: true, name: true, portfolioType: true } }),
    prisma.anticipatedInheritance.findMany({ where: { userId }, orderBy: { expectedYear: 'asc' } }),
    prisma.goal.findMany({
      where: { portfolio: { userId } },
      include: { portfolio: { select: { id: true, name: true } } },
      orderBy: { targetDate: 'asc' },
    }),
  ])

  const snapshots = await Promise.all(
    portfolios.map((p) => prisma.portfolioSnapshot.findFirst({ where: { portfolioId: p.id }, orderBy: { date: 'desc' } }))
  )

  const sharesValue = snapshots.reduce((s, snap, i) => portfolios[i].portfolioType !== 'TERM_DEPOSIT' ? s + (snap?.value ?? 0) : s, 0)
  const tdValue     = snapshots.reduce((s, snap, i) => portfolios[i].portfolioType === 'TERM_DEPOSIT' ? s + (snap?.value ?? 0) : s, 0)
  const propertyGrossValue = properties.reduce((s, p) => s + p.currentValue * (p.ownershipPct / 100), 0)
  const totalMortgages = properties.reduce((s, p) => s + (p.mortgage?.currentBalance ?? 0), 0)
  const propertyEquity = propertyGrossValue - totalMortgages
  const superBalance = superAccounts.reduce((s, a) => s + a.currentBalance, 0)
  const cashBalance = cashAccounts.reduce((s, a) => s + a.balance, 0)

  const totalAssets = sharesValue + tdValue + propertyGrossValue + superBalance + cashBalance
  const totalLiabilities = totalMortgages
  const snap: WealthSnapshot = { sharesValue, tdValue, propertyEquity, superBalance, cashBalance, propertyDebt: totalMortgages, propertyGrossValue }
  const settings = fireSettings ?? { includePropertyEquity: true, includeSuper: true, includeCash: true }
  const netWorth = computeNetWorth(snap, settings)

  const fireNumber = fireSettings ? fireSettings.annualExpenses / (fireSettings.withdrawalRate / 100) : null
  const fireProgress = fireNumber && fireNumber > 0 ? Math.min(100, (netWorth / fireNumber) * 100) : null

  // Portfolio snapshot map for goals progress
  const snapshotMap = new Map(
    portfolios.map((p, i) => [p.id, snapshots[i]?.value ?? 0])
  )

  // Goals with progress — VALUE goals compare portfolio value to target
  const goalsWithProgress = allGoals.map((g) => {
    const portfolioValue = snapshotMap.get(g.portfolioId) ?? 0
    const pct = g.targetValue > 0 ? Math.min(100, (portfolioValue / g.targetValue) * 100) : 0
    const daysLeft = g.targetDate ? Math.ceil((g.targetDate.getTime() - Date.now()) / 86400000) : null
    return { ...g, portfolioValue, pct, daysLeft }
  })
  const activeGoals = goalsWithProgress.filter((g) => g.pct < 100)

  void recordNetWorthSnapshot(userId, {
    totalAssets, totalLiabilities, netWorth,
    sharesValue, tdValue, propertyValue: propertyGrossValue, superBalance, cashBalance,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Net Worth</h1>
        <div className="flex gap-2 flex-wrap">
          <Link href="/wealth/properties"><Button variant="secondary" size="sm">+ Property</Button></Link>
          <Link href="/wealth/super"><Button variant="secondary" size="sm">+ Super</Button></Link>
          <Link href="/wealth/cash"><Button variant="secondary" size="sm">+ Cash</Button></Link>
          <Link href="/wealth/inheritance"><Button variant="secondary" size="sm">+ Inheritance</Button></Link>
          <Link href="/wealth/fire"><Button size="sm">FIRE Planner</Button></Link>
        </div>
      </div>

      {/* Net worth hero */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-6">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Net Worth</p>
            <p className="text-4xl font-bold text-gray-900">{formatCurrency(netWorth)}</p>
          </div>
          {fireProgress !== null && (
            <div className="sm:w-64">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>FIRE progress</span>
                <Link href="/wealth/fire" className="text-indigo-600 hover:underline">{fireProgress.toFixed(1)}% of {formatCurrency(fireNumber!)}</Link>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${fireProgress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Assets</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAssets)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Debt</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalLiabilities)}</p>
        </div>
        {fireSettings ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Monthly Savings</p>
            <p className="text-xl font-bold text-indigo-700">{formatCurrency(fireSettings.monthlySavings)}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Portfolios</p>
            <p className="text-xl font-bold text-indigo-700">{portfolios.length}</p>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Active Goals</p>
          <p className="text-xl font-bold text-amber-700">{activeGoals.length}</p>
          {allGoals.length > activeGoals.length && (
            <p className="text-xs text-gray-400">{allGoals.length - activeGoals.length} complete</p>
          )}
        </div>
      </div>

      {/* History chart */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Net Worth History</h2>
        <NetWorthHistoryChart />
      </div>

      {/* Balance sheet — two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ASSETS column */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Assets</h2>
            <span className="text-sm font-bold text-gray-900">{formatCurrency(totalAssets)}</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">

            {/* Investment portfolios */}
            {portfolios.map((p, i) => (
              <Link key={p.id} href={`/portfolios/${p.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{p.portfolioType === 'TERM_DEPOSIT' ? '💵' : '📈'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.portfolioType === 'TERM_DEPOSIT' ? 'Term deposit' : 'Investment portfolio'}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(snapshots[i]?.value ?? 0)}
                </span>
              </Link>
            ))}

            {/* Properties */}
            {properties.map((p) => (
              <Link key={p.id} href={`/wealth/properties/${p.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🏠</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.type}{p.ownershipPct < 100 ? ` · ${p.ownershipPct}% owned` : ''}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(p.currentValue * (p.ownershipPct / 100), p.currency)}
                </span>
              </Link>
            ))}

            {/* Super */}
            {superAccounts.map((a) => (
              <Link key={a.id} href={`/wealth/super/${a.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🦘</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600">{a.fundName}</p>
                    <p className="text-xs text-gray-400">Superannuation</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(a.currentBalance, a.currency)}</span>
              </Link>
            ))}

            {/* Cash */}
            {cashAccounts.map((a) => (
              <Link key={a.id} href={`/wealth/cash/${a.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="text-lg">💰</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600">{a.name}</p>
                    <p className="text-xs text-gray-400">{a.institution ?? 'Cash & savings'}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(a.balance, a.currency)}</span>
              </Link>
            ))}

            {/* Empty */}
            {totalAssets === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No assets yet — add a portfolio, property, super, or cash account.
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 rounded-b-2xl">
              <span className="text-sm font-semibold text-gray-700">Total Assets</span>
              <span className="text-sm font-bold text-gray-900">{formatCurrency(totalAssets)}</span>
            </div>
          </div>
        </div>

        {/* LIABILITIES column */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Liabilities</h2>
            <span className="text-sm font-bold text-gray-900">{formatCurrency(totalLiabilities)}</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">

            {properties.filter((p) => p.mortgage).map((p) => {
              const lvr = (p.mortgage!.currentBalance / p.currentValue) * 100
              return (
                <Link key={p.id} href={`/wealth/properties/${p.id}`} className="block px-5 py-4 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🏦</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600">{p.mortgage!.lender}</p>
                        <p className="text-xs text-gray-400">
                          {p.name} · {p.mortgage!.interestRate}% p.a. · {p.mortgage!.loanType === 'PI' ? 'P&I' : 'IO'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(p.mortgage!.currentBalance, p.currency)}
                    </span>
                  </div>
                  {/* LVR bar */}
                  <div className="ml-9">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>LVR {lvr.toFixed(1)}%</span>
                      <span>Equity {formatCurrency(p.currentValue * (p.ownershipPct / 100) - p.mortgage!.currentBalance, p.currency)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${lvr > 80 ? 'bg-red-400' : lvr > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(100, lvr)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              )
            })}

            {totalLiabilities === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No liabilities — add a mortgage via a property.
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 rounded-b-2xl">
              <span className="text-sm font-semibold text-gray-700">Total Liabilities</span>
              <span className="text-sm font-bold text-gray-900">{formatCurrency(totalLiabilities)}</span>
            </div>
          </div>

          {/* Add mortgage prompt if properties have none */}
          {properties.some((p) => !p.mortgage) && (
            <p className="text-xs text-gray-400 mt-2 px-1">
              {properties.filter((p) => !p.mortgage).map((p) => p.name).join(', ')} {properties.filter((p) => !p.mortgage).length === 1 ? 'has' : 'have'} no mortgage linked.{' '}
              <Link href="/wealth/properties" className="text-indigo-500 hover:underline">Add one →</Link>
            </p>
          )}
        </div>
      </div>

      {/* Anticipated Inheritances */}
      {inheritances.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Anticipated</h2>
            <Link href="/wealth/inheritance" className="text-xs text-indigo-500 hover:underline">Manage →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 border-dashed shadow-sm divide-y divide-gray-100">
            {inheritances.map((item) => {
              const effective = item.amount * (item.probability / 100)
              const yearsUntil = item.expectedYear - new Date().getFullYear()
              return (
                <Link key={item.id} href="/wealth/inheritance" className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🎁</span>
                    <div>
                      <p className="text-sm font-medium text-gray-500 group-hover:text-indigo-600">{item.name}</p>
                      <p className="text-xs text-gray-400">
                        {item.expectedYear} · {item.probability}% probability
                        {yearsUntil > 0 ? ` · in ${yearsUntil} yr${yearsUntil !== 1 ? 's' : ''}` : ''}
                        {!item.includeInFire && ' · excluded from FIRE'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-400 line-through">
                      {formatCurrency(item.amount, item.currency)}
                    </span>
                    {item.probability < 100 && (
                      <p className="text-xs text-violet-600">{formatCurrency(effective, item.currency)} effective</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary totals tile */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="px-6 py-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Total Assets</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAssets)}</p>
          </div>
          <div className="px-6 py-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Total Liabilities</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalLiabilities)}</p>
          </div>
          <div className="px-6 py-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Net Worth</p>
            <p className="text-xl font-bold text-emerald-700">{formatCurrency(netWorth)}</p>
          </div>
        </div>
      </div>

      {/* Goals overview */}
      {allGoals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Portfolio Goals</h2>
            <span className="text-xs text-gray-400">{activeGoals.length} active · {allGoals.length - activeGoals.length} complete</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {goalsWithProgress.slice(0, 6).map((g) => (
              <Link key={g.id} href={`/portfolios/${g.portfolioId}`} className="block px-5 py-4 hover:bg-gray-50 transition-colors group">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600">{g.name}</p>
                    <p className="text-xs text-gray-400">
                      {g.portfolio.name}
                      {g.daysLeft !== null && g.daysLeft > 0 ? ` · ${g.daysLeft}d left` : ''}
                      {g.daysLeft !== null && g.daysLeft <= 0 ? ' · past target date' : ''}
                    </p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{g.pct.toFixed(0)}%</p>
                    <p className="text-xs text-gray-400">{formatCurrency(g.portfolioValue)} / {formatCurrency(g.targetValue)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${g.pct >= 100 ? 'bg-emerald-500' : g.daysLeft !== null && g.daysLeft <= 0 ? 'bg-red-400' : 'bg-indigo-500'}`}
                    style={{ width: `${g.pct}%` }}
                  />
                </div>
              </Link>
            ))}
            {allGoals.length > 6 && (
              <div className="px-5 py-3 text-xs text-gray-400 text-center">
                +{allGoals.length - 6} more goals across portfolios
              </div>
            )}
          </div>
        </div>
      )}

      {/* FIRE prompt if not set up */}
      {!fireSettings && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-900">Set up your FIRE planner</p>
            <p className="text-xs text-indigo-600 mt-0.5">Enter your target annual spend to see how far you are from financial independence.</p>
          </div>
          <Link href="/wealth/fire"><Button size="sm">Get started →</Button></Link>
        </div>
      )}
    </div>
  )
}
