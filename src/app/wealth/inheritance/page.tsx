import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import { InheritanceForm } from '@/components/wealth/InheritanceForm'
import { DeleteInheritanceButton } from '@/components/wealth/DeleteInheritanceButton'

export const dynamic = 'force-dynamic'

export default async function InheritancePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const items = await prisma.anticipatedInheritance.findMany({
    where: { userId: session.user.id },
    orderBy: { expectedYear: 'asc' },
  })

  const totalEffective = items
    .filter((i) => i.includeInFire)
    .reduce((sum, i) => sum + i.amount * (i.probability / 100), 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/wealth" className="hover:text-indigo-600">Wealth</Link>
          <span>/</span>
          <span>Anticipated Inheritances</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Anticipated Inheritances</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Future windfalls that can boost your FIRE projections. Scaled by probability.
        </p>
      </div>

      {/* Total */}
      {items.length > 0 && (
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Total Effective (included in FIRE)
          </p>
          <p className="text-3xl font-bold text-violet-700 mt-1">
            {formatCurrency(totalEffective)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {items.filter((i) => i.includeInFire).length} of {items.length} entries · probability-weighted
          </p>
        </Card>
      )}

      {/* List */}
      {items.length === 0 ? (
        <Card className="text-center py-10 text-gray-500 text-sm border-dashed">
          No anticipated inheritances yet. Add one below.
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const effective = item.amount * (item.probability / 100)
            const yearsUntil = item.expectedYear - new Date().getFullYear()
            return (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      {!item.includeInFire && (
                        <span className="text-xs rounded-full bg-gray-100 text-gray-500 px-2 py-0.5">
                          excluded from FIRE
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                      <span>
                        <span className="text-gray-400">Expected: </span>
                        <span className="font-medium">{item.expectedYear}</span>
                        <span className="text-gray-400 ml-1">
                          ({yearsUntil > 0 ? `in ${yearsUntil} yr${yearsUntil !== 1 ? 's' : ''}` : 'this year'})
                        </span>
                      </span>
                      <span>
                        <span className="text-gray-400">Probability: </span>
                        <span className="font-medium">{item.probability}%</span>
                      </span>
                      {item.probability < 100 && (
                        <span>
                          <span className="text-gray-400">Effective: </span>
                          <span className="font-medium text-violet-700">{formatCurrency(effective, item.currency)}</span>
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">{item.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(item.amount, item.currency)}
                      </p>
                      {item.probability < 100 && (
                        <p className="text-xs text-violet-600">{formatCurrency(effective, item.currency)} effective</p>
                      )}
                    </div>
                    <DeleteInheritanceButton id={item.id} name={item.name} />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add form */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Inheritance</h2>
        <InheritanceForm />
      </Card>
    </div>
  )
}
