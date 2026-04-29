import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function BudgetPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const categoryCount = await prisma.budgetCategory.count({
    where: { userId: session.user.id, isActive: true },
  })

  if (categoryCount === 0) redirect('/budget/setup')

  const now = new Date()
  redirect(`/budget/${now.getFullYear()}/${now.getMonth() + 1}`)
}
