import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { name, group, icon, sortOrder, isActive } = body

  const existing = await prisma.budgetCategory.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.budgetCategory.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(group !== undefined && { group }),
      ...(icon !== undefined && { icon: icon?.trim() || null }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.budgetCategory.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Check if there are any budget/actual records
  const hasData = await prisma.budget.count({ where: { categoryId: id } })
  const hasActuals = await prisma.budgetActual.count({ where: { categoryId: id } })

  if (hasData > 0 || hasActuals > 0) {
    // Soft delete — preserve history
    await prisma.budgetCategory.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ softDeleted: true })
  }

  await prisma.budgetCategory.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
