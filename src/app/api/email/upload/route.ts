import { NextRequest } from 'next/server'
import { parseEmlBuffer } from '@/lib/email/emlParser'
import { auth } from '@/lib/auth'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = new Set(['message/rfc822', 'application/octet-stream', ''])
// Some browsers/clients omit the MIME type for .eml; allow if extension matches.

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'file field required' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    )
  }
  const lowerName = file.name?.toLowerCase() ?? ''
  const looksLikeEml = lowerName.endsWith('.eml') || lowerName.endsWith('.msg')
  if (!ALLOWED_TYPES.has(file.type) && !looksLikeEml) {
    return Response.json(
      { error: 'Unsupported file type — upload an .eml message file' },
      { status: 415 },
    )
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await parseEmlBuffer(buffer)
  return Response.json(result)
}
