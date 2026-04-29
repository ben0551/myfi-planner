import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BankImport } from '@/components/budget/BankImport'

export const dynamic = 'force-dynamic'

export default async function BankImportPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const categories = await prisma.budgetCategory.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, group: true, icon: true },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bank Import</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Import transactions from any AU bank CSV export — CBA, ANZ, NAB, Westpac, Up, ING
        </p>
      </div>
      <BankImport categories={categories} />
    </div>
  )
}
