import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'node:crypto'
import { ProfileCard } from '@/components/settings/ProfileCard'
import { ApiKeyCard } from '@/components/settings/ApiKeyCard'
import { EmailImportCard } from '@/components/settings/EmailImportCard'

export const dynamic = 'force-dynamic'

const IMPORT_DOMAIN = process.env.MAILGUN_IMPORT_DOMAIN ?? ''

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  let user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, apiKey: true, emailImportToken: true },
  })
  if (!user) redirect('/login')

  // Auto-generate email import token on first visit
  if (!user.emailImportToken) {
    user = await prisma.user.update({
      where: { id: session.user.id },
      data: { emailImportToken: randomBytes(12).toString('hex') },
      select: { email: true, name: true, apiKey: true, emailImportToken: true },
    })
  }

  const importAddress = IMPORT_DOMAIN
    ? `${user.emailImportToken}@${IMPORT_DOMAIN}`
    : null

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Account preferences and integrations
        </p>
      </div>

      <ProfileCard initialName={user.name ?? ''} initialEmail={user.email} />

      <ApiKeyCard initialApiKey={user.apiKey ?? null} />

      <EmailImportCard
        initialAddress={importAddress}
        initialToken={user.emailImportToken!}
        domain={IMPORT_DOMAIN || null}
        configured={!!IMPORT_DOMAIN}
      />
    </div>
  )
}
