import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.aISettings.findUnique({ where: { userId: session.user.id } })
  return Response.json(settings ?? { provider: 'anthropic', model: null, apiKey: null, baseUrl: null })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider, model, apiKey, baseUrl } = await req.json()

  const settings = await prisma.aISettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, provider, model: model || null, apiKey: apiKey || null, baseUrl: baseUrl || null },
    update: { provider, model: model || null, apiKey: apiKey || null, baseUrl: baseUrl || null },
  })

  return Response.json(settings)
}
