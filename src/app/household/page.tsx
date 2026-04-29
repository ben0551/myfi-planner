import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { HouseholdDashboard } from '@/components/household/HouseholdDashboard'

export const dynamic = 'force-dynamic'

export default async function HouseholdPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const membership = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    include: {
      household: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { joinedAt: 'asc' },
          },
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Household</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Combined net worth across family accounts
        </p>
      </div>
      <HouseholdDashboard
        currentUserId={session.user.id}
        initialMembership={membership ? {
          role: membership.role,
          household: {
            id: membership.household.id,
            name: membership.household.name,
            inviteCode: membership.household.inviteCode,
            members: membership.household.members.map((m) => ({
              id: m.id,
              userId: m.userId,
              role: m.role,
              name: m.user.name,
              email: m.user.email,
            })),
          },
        } : null}
      />
    </div>
  )
}
