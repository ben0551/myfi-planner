import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { randomBytes } from 'node:crypto'

const IMPORT_DOMAIN = process.env.MAILGUN_IMPORT_DOMAIN ?? ''

function newToken() {
  return randomBytes(12).toString('hex') // 24-char hex, unguessable
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailImportToken: true },
  })
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 })

  // Auto-generate token on first access
  if (!user.emailImportToken) {
    user = await prisma.user.update({
      where: { id: session.user.id },
      data: { emailImportToken: newToken() },
      select: { emailImportToken: true },
    })
  }

  return Response.json({
    token: user.emailImportToken,
    address: IMPORT_DOMAIN ? `${user.emailImportToken}@${IMPORT_DOMAIN}` : null,
    domain: IMPORT_DOMAIN || null,
  })
}

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { emailImportToken: newToken() },
    select: { emailImportToken: true },
  })

  return Response.json({
    token: user.emailImportToken,
    address: IMPORT_DOMAIN ? `${user.emailImportToken}@${IMPORT_DOMAIN}` : null,
    domain: IMPORT_DOMAIN || null,
  })
}
