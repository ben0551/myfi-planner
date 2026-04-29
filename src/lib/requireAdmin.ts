import { auth } from '@/lib/auth'

export async function requireAdmin(): Promise<Response | null> {
  const session = await auth()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
