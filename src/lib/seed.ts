import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    console.warn('[seed] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed')
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return // idempotent

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
  console.log(`[seed] Admin user created: ${email}`)

  // Ensure SiteSettings singleton exists
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, requireApproval: false },
  })
}
