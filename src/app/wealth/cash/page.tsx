import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import { CashAccountForm } from '@/components/wealth/CashAccountForm'

export const dynamic = 'force-dynamic'

export default async function CashPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const accounts = await prisma.cashAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' },
  })

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/wealth" className="hover:text-indigo-600">Wealth</Link>
          <span>/</span>
          <span>Cash</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Cash Accounts</h1>
      </div>

      {/* Total */}
      {accounts.length > 0 && (
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Total Cash Balance
          </p>
          <p className="text-3xl font-bold text-sky-700 mt-1">
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </p>
        </Card>
      )}

      {/* Accounts list */}
      {accounts.length === 0 ? (
        <Card className="text-center py-10 text-gray-500 text-sm border-dashed">
          No cash accounts yet. Add your first account below.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <Link key={a.id} href={`/wealth/cash/${a.id}`} className="block group">
              <Card className="group-hover:border-sky-300 transition-colors h-full">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-sky-700 transition-colors">{a.name}</h3>
                    {a.institution && (
                      <p className="text-sm text-gray-500 mt-0.5">{a.institution}</p>
                    )}
                  </div>
                  <span className="text-xs text-indigo-400 mt-1">Edit →</span>
                </div>
                <p className="text-2xl font-bold text-sky-700 mt-3">
                  {formatCurrency(a.balance, a.currency)}
                </p>
                {a.notes && (
                  <p className="text-xs text-gray-400 mt-2 italic">{a.notes}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Add Account form */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Cash Account</h2>
        <CashAccountForm />
      </Card>
    </div>
  )
}
