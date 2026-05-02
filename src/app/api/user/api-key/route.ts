import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { randomBytes } from 'node:crypto'

function newApiKey() {
  return 'mfp_' + randomBytes(24).toString('hex') // mfp_<48-char hex>
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { apiKey: true },
  })
  return Response.json({ apiKey: user?.apiKey ?? null })
}

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { apiKey: newApiKey() },
    select: { apiKey: true },
  })
  return Response.json({ apiKey: user.apiKey })
}

export async function DELETE(_req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { apiKey: null },
  })
  return Response.json({ ok: true })
}
