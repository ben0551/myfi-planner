import { NextRequest } from 'next/server'
import { parseEmlBuffer } from '@/lib/email/emlParser'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'file field required' }, { status: 400 })
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await parseEmlBuffer(buffer)
  return Response.json(result)
}
