export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login, /register (public auth pages)
     * - /api/auth/** (NextAuth routes)
     * - /api/research/**, /api/asx/**, /api/prices/** (public market data — no user data)
     * - /_next/static, /_next/image (Next.js internals)
     * - /favicon.ico
     */
    '/((?!login|register|api/auth|api/research|api/asx|api/prices|_next/static|_next/image|favicon\\.ico).*)',
  ],
}
