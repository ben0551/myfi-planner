import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.aISettings.findUnique({ where: { userId: session.user.id } })
  // Never send the encrypted (or plaintext) apiKey to the client.
  return Response.json({
    provider: settings?.provider ?? 'anthropic',
    model: settings?.model ?? null,
    baseUrl: settings?.baseUrl ?? null,
    hasApiKey: Boolean(settings?.apiKey),
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider, model, apiKey, baseUrl } = await req.json()

  // If apiKey is missing/undefined/empty, KEEP the existing one (don't wipe it).
  // If apiKey is a non-empty string, encrypt and replace.
  const existing = await prisma.aISettings.findUnique({ where: { userId: session.user.id } })
  const nextApiKey = (typeof apiKey === 'string' && apiKey.length > 0)
    ? encrypt(apiKey)
    : (existing?.apiKey ?? null)

  const settings = await prisma.aISettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      provider, model: model || null, apiKey: nextApiKey, baseUrl: baseUrl || null,
    },
    update: { provider, model: model || null, apiKey: nextApiKey, baseUrl: baseUrl || null },
  })

  return Response.json({
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    hasApiKey: Boolean(settings.apiKey),
  })
}
