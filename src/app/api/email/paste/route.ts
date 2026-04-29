import { NextRequest } from 'next/server'
import { parseStakeEmail } from '@/lib/email/stakeParser'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { rawText } = body
  if (!rawText || typeof rawText !== 'string') {
    return Response.json({ error: 'rawText is required' }, { status: 400 })
  }
  const result = parseStakeEmail(rawText)
  return Response.json(result)
}
