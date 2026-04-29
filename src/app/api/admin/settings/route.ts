import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const settings = await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, requireApproval: false },
  })
  return Response.json(settings)
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const update: Record<string, unknown> = {}
  if ('requireApproval' in body) update.requireApproval = Boolean(body.requireApproval)
  if ('fmpApiKey' in body) update.fmpApiKey = body.fmpApiKey || null

  const settings = await prisma.siteSettings.upsert({
    where: { id: 1 },
    update,
    create: { id: 1, requireApproval: false, ...update },
  })
  return Response.json(settings)
}
