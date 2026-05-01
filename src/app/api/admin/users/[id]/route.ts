import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin()
  if (denied) return denied

  const session = await auth()
  const { id } = await params
  const body = await request.json()

  // ── Special actions ──────────────────────────────────────────────────────────

  if (body.action === 'resetPassword') {
    const { password } = body
    if (!password || typeof password !== 'string' || password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.user.update({ where: { id }, data: { passwordHash } })
    return Response.json({ ok: true })
  }

  if (body.action === 'sendResetLink') {
    const user = await prisma.user.findUnique({ where: { id }, select: { email: true, name: true } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

    await prisma.verificationToken.deleteMany({ where: { identifier: user.email } })
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000)
    await prisma.verificationToken.create({ data: { identifier: user.email, token, expires } })

    const resetUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/reset-password/${token}`

    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your MyFiPlanner password',
        html: `<p>Hi ${user.name ?? user.email},</p><p>An admin has sent you a password reset link.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link expires in 1 hour.</p>`,
      })
      return Response.json({ ok: true, sent: true })
    } catch {
      // SMTP not configured — return URL for admin to share manually
      return Response.json({ ok: true, sent: false, resetUrl })
    }
  }

  if (body.action === 'generateApiKey') {
    const apiKey = `mfp_${crypto.randomBytes(32).toString('hex')}`
    await prisma.user.update({ where: { id }, data: { apiKey } })
    return Response.json({ apiKey })
  }

  if (body.action === 'revokeApiKey') {
    await prisma.user.update({ where: { id }, data: { apiKey: null } })
    return Response.json({ apiKey: null })
  }

  // ── Status / role updates ────────────────────────────────────────────────────

  const { status, role } = body

  if (id === session!.user.id && (status === 'DISABLED' || role === 'USER')) {
    return Response.json({ error: 'Cannot demote or disable your own account' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
    },
    select: { id: true, email: true, name: true, role: true, status: true },
  })
  return Response.json(user)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin()
  if (denied) return denied

  const session = await auth()
  const { id } = await params

  if (id === session!.user.id) {
    return Response.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  await prisma.user.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
