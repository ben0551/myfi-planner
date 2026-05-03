import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const settings = await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, requireApproval: false },
  })

  // Never return the encrypted/plaintext secrets to the client. Indicate
  // presence so the form can show "(set)" placeholders.
  return Response.json({
    id: settings.id,
    requireApproval: settings.requireApproval,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpFrom: settings.smtpFrom,
    hasFmpApiKey: Boolean(settings.fmpApiKey),
    hasSmtpPass: Boolean(settings.smtpPass),
  })
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const update: Record<string, unknown> = {}
  if ('requireApproval' in body) update.requireApproval = Boolean(body.requireApproval)
  if ('smtpHost' in body) update.smtpHost = body.smtpHost || null
  if ('smtpPort' in body) update.smtpPort = body.smtpPort ? Number(body.smtpPort) : null
  if ('smtpUser' in body) update.smtpUser = body.smtpUser || null
  if ('smtpFrom' in body) update.smtpFrom = body.smtpFrom || null

  // Secret fields: only update if a non-empty new value is provided.
  // Empty / undefined → keep existing.
  if (typeof body.fmpApiKey === 'string' && body.fmpApiKey.length > 0) {
    update.fmpApiKey = encrypt(body.fmpApiKey)
  }
  if (typeof body.smtpPass === 'string' && body.smtpPass.length > 0) {
    update.smtpPass = encrypt(body.smtpPass)
  }

  const settings = await prisma.siteSettings.upsert({
    where: { id: 1 },
    update,
    create: { id: 1, requireApproval: false, ...update },
  })

  return Response.json({
    id: settings.id,
    requireApproval: settings.requireApproval,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpFrom: settings.smtpFrom,
    hasFmpApiKey: Boolean(settings.fmpApiKey),
    hasSmtpPass: Boolean(settings.smtpPass),
  })
}
