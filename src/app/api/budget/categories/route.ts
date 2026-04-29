import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const categories = await prisma.budgetCategory.findMany({
    where: { userId: session.user.id },
    orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, group, icon, sortOrder } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const category = await prisma.budgetCategory.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      group: group ?? 'LIVING',
      icon: icon?.trim() || null,
      sortOrder: sortOrder ?? 0,
    },
  })

  return NextResponse.json(category, { status: 201 })
}
