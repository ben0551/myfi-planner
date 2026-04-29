import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { BUDGET_GROUPS, GROUP_LABELS, type BudgetGroup } from '@/lib/budget'
import { CategoryForm } from '@/components/budget/CategoryForm'

export const dynamic = 'force-dynamic'

export default async function BudgetCategoriesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const categories = await prisma.budgetCategory.findMany({
    where: { userId: session.user.id },
    orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })

  const grouped = BUDGET_GROUPS.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    active: categories.filter((c) => c.group === group && c.isActive),
    inactive: categories.filter((c) => c.group === group && !c.isActive),
  })).filter((g) => g.active.length > 0 || g.inactive.length > 0)

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/budget" className="hover:text-indigo-600">Budget</Link>
          <span>/</span>
          <span>Categories</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Budget Categories</h1>
      </div>

      {grouped.map(({ group, label, active, inactive }) => (
        <div key={group}>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</h2>
          <Card>
            <div className="divide-y divide-gray-100 dark:divide-slate-700 -mx-5 -mt-5">
              {active.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-base w-6 text-center">{c.icon ?? '•'}</span>
                  <span className="flex-1 text-sm text-gray-800 dark:text-slate-200">{c.name}</span>
                </div>
              ))}
              {inactive.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3 opacity-40">
                  <span className="text-base w-6 text-center">{c.icon ?? '•'}</span>
                  <span className="flex-1 text-sm text-gray-400 line-through">{c.name}</span>
                  <span className="text-xs text-gray-400">inactive</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
              <CategoryForm editing={undefined} />
            </div>
          </Card>
        </div>
      ))}

      {grouped.length === 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Add your first category</h2>
          <CategoryForm />
        </Card>
      )}

      {grouped.length === 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Or start with Australian defaults</h2>
          <Link
            href="/budget/setup"
            className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Load default categories
          </Link>
        </Card>
      )}
    </div>
  )
}
