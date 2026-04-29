import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AU_DEFAULT_CATEGORIES } from '@/lib/budget'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function BudgetSetupPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const existing = await prisma.budgetCategory.count({ where: { userId: session.user.id } })
  if (existing > 0) redirect('/budget')

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Set up your budget</h1>
        <p className="text-sm text-gray-500 mt-1">
          We'll create {AU_DEFAULT_CATEGORIES.length} sensible Australian categories to get you started.
          You can add, rename, or remove them at any time.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Categories that will be created</h2>
        <div className="divide-y divide-gray-100 -mx-5">
          {AU_DEFAULT_CATEGORIES.map((c, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-2 text-sm">
              <span className="text-base w-6 text-center">{c.icon}</span>
              <span className="flex-1 text-gray-800">{c.name}</span>
              <span className="text-xs text-gray-400">{c.group}</span>
            </div>
          ))}
        </div>
      </Card>

      <form action={async () => {
        'use server'
        const session = await auth()
        if (!session) return

        for (const cat of AU_DEFAULT_CATEGORIES) {
          await prisma.budgetCategory.create({
            data: {
              userId: session.user.id,
              name: cat.name,
              group: cat.group,
              icon: cat.icon,
              sortOrder: cat.sortOrder,
            },
          })
        }

        const now = new Date()
        redirect(`/budget/${now.getFullYear()}/${now.getMonth() + 1}`)
      }}>
        <button
          type="submit"
          className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
        >
          Create categories &amp; start budgeting →
        </button>
      </form>
    </div>
  )
}
