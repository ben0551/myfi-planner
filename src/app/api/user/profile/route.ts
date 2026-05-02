import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true },
  })
  return Response.json(user)
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email } = await request.json()

  if (email && email !== session.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return Response.json({ error: 'Email already in use' }, { status: 409 })
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: name !== undefined ? (name?.trim() || null) : undefined,
      email: email?.trim() || undefined,
    },
    select: { id: true, name: true, email: true },
  })
  return Response.json(user)
}
