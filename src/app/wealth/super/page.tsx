import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { SuperAccountForm } from '@/components/wealth/SuperAccountForm'
import { SuperBalanceChart } from '@/components/wealth/SuperBalanceChart'

export const dynamic = 'force-dynamic'

export default async function SuperPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const accounts = await prisma.superAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { fundName: 'asc' },
    include: {
      balanceHistory: { orderBy: { date: 'asc' } },
    },
  })

  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0)

  // Most-recent year-on-year growth per account
  function getRecentYoY(history: { date: Date; balance: number }[]) {
    const byYear = new Map<number, number>()
    for (const h of history) byYear.set(h.date.getFullYear(), h.balance)
    const years = Array.from(byYear.keys()).sort()
    if (years.length < 2) return null
    const latest = byYear.get(years[years.length - 1])!
    const prev   = byYear.get(years[years.length - 2])!
    const growthAmount = latest - prev
    const growthPct = prev > 0 ? ((latest - prev) / prev) * 100 : null
    return { year: years[years.length - 1], growthAmount, growthPct }
  }

  // Build a combined history across all accounts (sum balances on each date)
  const combinedMap = new Map<string, number>()
  for (const a of accounts) {
    for (const h of a.balanceHistory) {
      const d = h.date.toISOString().slice(0, 10)
      combinedMap.set(d, (combinedMap.get(d) ?? 0) + h.balance)
    }
  }
  const combinedHistory = Array.from(combinedMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/wealth" className="hover:text-indigo-600">Wealth</Link>
          <span>/</span>
          <span>Super</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Superannuation</h1>
      </div>

      {/* Total */}
      {accounts.length > 0 && (
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Total Super Balance
          </p>
          <p className="text-3xl font-bold text-amber-700 mt-1">
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-sm text-gray-500 mt-1">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
          {combinedHistory.length > 1 && (
            <div className="mt-4">
              <SuperBalanceChart history={combinedHistory} />
            </div>
          )}
        </Card>
      )}

      {/* Accounts list */}
      {accounts.length === 0 ? (
        <Card className="text-center py-10 text-gray-500 text-sm border-dashed">
          No super accounts yet. Add your first account below.
        </Card>
      ) : (
        <div className="space-y-4">
          {accounts.map((a) => (
            <Link key={a.id} href={`/wealth/super/${a.id}`} className="block group">
              <Card className="group-hover:border-amber-300 transition-colors">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">
                      {a.fundName}
                    </h3>
                    {a.accountNumber && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        Account: {a.accountNumber}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-700">
                      {formatCurrency(a.currentBalance, a.currency)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Updated {formatDate(a.balanceUpdatedAt)}
                    </p>
                    {(() => {
                      const yoy = getRecentYoY(a.balanceHistory)
                      if (!yoy) return null
                      return (
                        <p className={`text-sm font-medium mt-1 ${yoy.growthAmount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {yoy.growthAmount >= 0 ? '+' : ''}{formatCurrency(yoy.growthAmount, a.currency)}
                          {yoy.growthPct !== null && (
                            <span className="text-xs ml-1 opacity-80">
                              ({yoy.growthPct >= 0 ? '+' : ''}{yoy.growthPct.toFixed(1)}%)
                            </span>
                          )}
                          <span className="text-xs text-gray-400 font-normal ml-1">{yoy.year}</span>
                        </p>
                      )
                    })()}
                  </div>
                </div>
                {a.balanceHistory.length > 1 && (
                  <div className="mt-3">
                    <SuperBalanceChart
                      history={a.balanceHistory
                        .sort((x, y) => x.date.getTime() - y.date.getTime())
                        .map((h) => ({ date: h.date.toISOString().slice(0, 10), value: h.balance }))}
                      currency={a.currency}
                    />
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-6 text-sm text-gray-600 border-t border-gray-100 pt-3">
                  <span>
                    <span className="text-gray-500">Employer contribution: </span>
                    <span className="font-medium">{a.employerContribPct}%</span>
                  </span>
                  <span>
                    <span className="text-gray-500">Employee contribution: </span>
                    <span className="font-medium">{a.employeeContribPct}%</span>
                  </span>
                  {a.notes && (
                    <span className="text-gray-400 italic">{a.notes}</span>
                  )}
                  <span className="ml-auto text-xs text-indigo-500">View details →</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Add Account form */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Super Account</h2>
        <SuperAccountForm />
      </Card>
    </div>
  )
}
