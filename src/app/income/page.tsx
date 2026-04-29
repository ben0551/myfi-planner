import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Card } from '@/components/ui/Card'
import { IncomeDashboard } from '@/components/income/IncomeDashboard'

export const dynamic = 'force-dynamic'

export default async function IncomePage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dividend Income</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Trailing 12 months actual · Next 12 months projected from historical patterns
        </p>
      </div>

      <IncomeDashboard />
    </div>
  )
}
