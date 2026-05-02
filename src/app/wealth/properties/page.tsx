import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { PropertyForm } from '@/components/wealth/PropertyForm'

export const dynamic = 'force-dynamic'

export default async function PropertiesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const allProperties = await prisma.property.findMany({
    where: { userId: session.user.id },
    include: { mortgage: true },
    orderBy: { name: 'asc' },
  })

  const properties = allProperties.filter((p) => !p.soldDate)
  const soldProperties = allProperties.filter((p) => p.soldDate)

  const totalGross = properties.reduce(
    (sum, p) => sum + p.currentValue * (p.ownershipPct / 100),
    0
  )
  const totalDebt = properties.reduce(
    (sum, p) => sum + (p.mortgage?.currentBalance ?? 0),
    0
  )
  const totalEquity = totalGross - totalDebt

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/wealth" className="hover:text-indigo-600">Wealth</Link>
            <span>/</span>
            <span>Properties</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
        </div>
      </div>

      {/* Summary */}
      {properties.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Gross Value
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(totalGross)}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Total Debt
            </p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {formatCurrency(totalDebt)}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Net Equity
            </p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {formatCurrency(totalEquity)}
            </p>
          </Card>
        </div>
      )}

      {/* Properties list */}
      {allProperties.length === 0 ? (
        <Card className="text-center py-10 text-gray-500 text-sm border-dashed">
          No properties yet. Add your first property below.
        </Card>
      ) : properties.length === 0 ? (
        <Card className="text-center py-6 text-gray-400 text-sm border-dashed">
          No active properties — see sold properties below.
        </Card>
      ) : (
        <div className="space-y-4">
          {properties.map((p) => {
            const ownedValue = p.currentValue * (p.ownershipPct / 100)
            const equity = ownedValue - (p.mortgage?.currentBalance ?? 0)
            const lvr =
              p.mortgage && p.currentValue > 0
                ? (p.mortgage.currentBalance / p.currentValue) * 100
                : null
            const gain = p.currentValue - p.purchasePrice
            const gainPct = p.purchasePrice > 0 ? (gain / p.purchasePrice) * 100 : null

            return (
              <Card key={p.id} padding={false} className="overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{p.name}</h3>
                      <Badge variant="gray">{p.type}</Badge>
                      {p.ownershipPct < 100 && (
                        <Badge variant="blue">{p.ownershipPct}% owned</Badge>
                      )}
                    </div>
                    {p.address && (
                      <p className="text-sm text-gray-500 mt-0.5">{p.address}</p>
                    )}
                  </div>
                  <Link
                    href={`/wealth/properties/${p.id}`}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Edit →
                  </Link>
                </div>
                <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Stat label="Current Value" value={formatCurrency(p.currentValue, p.currency)} />
                  <Stat
                    label="Net Equity"
                    value={formatCurrency(equity, p.currency)}
                    className="text-emerald-700"
                  />
                  {lvr !== null && (
                    <Stat
                      label="LVR"
                      value={`${lvr.toFixed(1)}%`}
                      className={lvr > 80 ? 'text-red-600' : lvr > 60 ? 'text-yellow-600' : 'text-green-600'}
                    />
                  )}
                  {gainPct !== null && (
                    <Stat
                      label="Capital Gain"
                      value={`${gain >= 0 ? '+' : ''}${formatCurrency(gain, p.currency)} (${gainPct.toFixed(1)}%)`}
                      className={gain >= 0 ? 'text-green-600' : 'text-red-600'}
                    />
                  )}
                  <Stat label="Purchased" value={formatDate(p.purchaseDate)} />
                  {p.mortgage && (
                    <Stat
                      label="Mortgage Balance"
                      value={formatCurrency(p.mortgage.currentBalance, p.currency)}
                      className="text-red-600"
                    />
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Sold properties */}
      {soldProperties.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Sold Properties</h2>
          <div className="space-y-3">
            {soldProperties.map((p) => {
              const gain = p.salePrice ? p.salePrice - (p.costBase ?? p.purchasePrice) : null
              return (
                <Card key={p.id} padding={false} className="overflow-hidden opacity-75">
                  <div className="flex items-center justify-between px-6 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-700">{p.name}</h3>
                        <Badge variant="red">Sold {formatDate(p.soldDate)}</Badge>
                        <Badge variant="gray">{p.type}</Badge>
                      </div>
                      {p.salePrice && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          Sold for {formatCurrency(p.salePrice, p.currency)}
                          {gain !== null && (
                            <span className={`ml-2 ${gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {gain >= 0 ? '+' : ''}{formatCurrency(gain, p.currency)} gain
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <Link href={`/wealth/properties/${p.id}`} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      View →
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Add Property form */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Property</h2>
        <PropertyForm />
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  className = '',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${className || 'text-gray-900'}`}>{value}</p>
    </div>
  )
}
