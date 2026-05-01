import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { token, password } = body

  if (!token || !password) {
    return Response.json({ error: 'Token and password are required' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } })
  if (!record) {
    return Response.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
    return Response.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email: record.identifier } })
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {})

  return Response.json({ ok: true })
}
