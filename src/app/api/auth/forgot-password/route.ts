import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : null
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

  // Always respond 200 — never reveal whether an account exists
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return Response.json({ ok: true })

  // Delete any existing reset tokens for this user
  await prisma.verificationToken.deleteMany({ where: { identifier: email } })

  // Create a 1-hour reset token
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000)
  await prisma.verificationToken.create({ data: { identifier: email, token, expires } })

  const resetUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/reset-password/${token}`

  try {
    await sendEmail({
      to: email,
      subject: 'Reset your MyFiPlanner password',
      html: `
        <p>Hi ${user.name ?? user.email},</p>
        <p>You requested a password reset for your MyFiPlanner account.</p>
        <p><a href="${resetUrl}" style="color:#4f46e5">Click here to reset your password</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      `,
    })
  } catch {
    // SMTP not configured — token is still stored; admin can send the link manually
  }

  return Response.json({ ok: true })
}
