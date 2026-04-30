import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { currentFY, getFYLabel } from '@/lib/tax'
import { CGTHarvestPanel } from '@/components/tax/CGTHarvestPanel'

export const dynamic = 'force-dynamic'

export default async function CGTHarvestPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { fy } = await searchParams
  const fyYear = fy ? parseInt(fy, 10) : currentFY()
  const fyLabel = getFYLabel(fyYear)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/tax" className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200">
          ← Tax Summary
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">CGT Harvest Opportunities</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {fyLabel} · Positions at an unrealised loss that could offset your realised gains
        </p>
      </div>

      <div className="rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-xs text-blue-700 dark:text-blue-300">
        <strong>How it works:</strong> Capital losses from selling these positions reduce your net assessable
        capital gain dollar-for-dollar. Losses must be realised before 30 June to count in {fyLabel}.
        Excess losses carry forward to offset future gains.
      </div>

      <CGTHarvestPanel fyYear={fyYear} />
    </div>
  )
}
