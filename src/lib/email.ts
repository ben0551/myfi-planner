import nodemailer from 'nodemailer'
import { prisma } from './prisma'

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  if (!settings?.smtpHost || !settings?.smtpFrom) {
    throw new Error('SMTP not configured')
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort ?? 587,
    secure: settings.smtpPort === 465,
    auth: settings.smtpUser && settings.smtpPass
      ? { user: settings.smtpUser, pass: settings.smtpPass }
      : undefined,
  })

  await transporter.sendMail({
    from: settings.smtpFrom,
    to,
    subject,
    html,
  })
}

export async function isSmtpConfigured(): Promise<boolean> {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  return Boolean(settings?.smtpHost && settings?.smtpFrom)
}
