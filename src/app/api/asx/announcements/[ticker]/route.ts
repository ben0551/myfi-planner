import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncAnnouncements } from '@/lib/asx/cache'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const upper = ticker.toUpperCase()

  // Sync announcements (upserts, non-blocking if error)
  await syncAnnouncements(upper)

  const announcements = await prisma.announcement.findMany({
    where: { ticker: upper },
    orderBy: { releasedAt: 'desc' },
    take: 20,
  })
  return Response.json(announcements)
}
