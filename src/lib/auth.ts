import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import MicrosoftEntraId from 'next-auth/providers/microsoft-entra-id'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })
        if (!user || !user.passwordHash) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!valid) return null

        if (user.status === 'PENDING') throw new Error('PENDING')
        if (user.status === 'DISABLED') throw new Error('DISABLED')

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
      ? [
          MicrosoftEntraId({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID ?? 'common'}/v2.0`,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // OAuth sign-ins: check status and handle new user approval
      if (account?.type === 'oauth' && user.id) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
        if (!dbUser) return true

        // Brand-new OAuth user (created in the last 30s by PrismaAdapter)
        const isNew = Date.now() - dbUser.createdAt.getTime() < 30_000
        if (isNew) {
          const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
          if (settings?.requireApproval) {
            await prisma.user.update({ where: { id: user.id }, data: { status: 'PENDING' } })
            return '/login?error=PENDING'
          }
        }

        if (dbUser.status === 'PENDING') return '/login?error=PENDING'
        if (dbUser.status === 'DISABLED') return '/login?error=DISABLED'
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = (user as any).role
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.user.role = token.role as string
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {})
      }
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
})
