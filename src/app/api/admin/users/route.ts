import { requireAdmin } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { portfolios: true } },
    },
  })
  return Response.json(users)
}
