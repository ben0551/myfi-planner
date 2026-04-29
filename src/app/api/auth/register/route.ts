import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, password, name } = body

  if (!email || !password) {
    return Response.json({ error: 'Email and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: 'An account with that email already exists' }, { status: 409 })
  }

  // Check site settings for approval requirement
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  const requireApproval = settings?.requireApproval ?? false

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      role: 'USER',
      status: requireApproval ? 'PENDING' : 'ACTIVE',
    },
  })

  return Response.json(
    { requireApproval },
    { status: 201 }
  )
}
