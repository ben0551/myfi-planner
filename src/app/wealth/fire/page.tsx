import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/formatters'
import {
  computeNetWorth,
  computeFireProjection,
  computeBridgeToFire,
  generateProjectionSeries,
  inheritancesToLumpSums,
  WealthSnapshot,
  FireInputs,
} from '@/lib/wealth'
import { calcTermDeposit } from '@/lib/termDeposit'
import { FireSettingsForm } from '@/components/wealth/FireSettingsForm'
import { FireProjectionChart } from '@/components/wealth/FireProjectionChart'

export const dynamic = 'force-dynamic'

function fmtMonths(m: number): string {
  if (m >= 24) return `${(m / 12).toFixed(1)} years`
  if (m >= 12) return `${(m / 12).toFixed(1)} years`
  return `${m} month${m !== 1 ? 's' : ''}`
}

export default async function FirePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id

  const [properties, superAccounts, cashAccounts, fireSettings, portfolios, inheritances] =
    await Promise.all([
      prisma.property.findMany({
        where: { userId, soldDate: null },
        include: { mortgage: true },
      }),
      prisma.superAccount.findMany({ where: { userId } }),
      prisma.cashAccount.findMany({ where: { userId } }),
      prisma.fireSettings.findUnique({ where: { userId } }),
      prisma.portfolio.findMany({ where: { userId }, select: { id: true, portfolioType: true, tdPrincipal: true, tdRate: true, tdStartDate: true, tdMaturityDate: true } }),
      prisma.anticipatedInheritance.findMany({
        where: { userId, includeInFire: true },
        orderBy: { expectedYear: 'asc' },
      }),
    ])

  // Batch snapshot query (avoids N+1)
  const allSnapshots = await prisma.portfolioSnapshot.findMany({
    where: { portfolioId: { in: portfolios.map((p) => p.id) } },
    orderBy: { date: 'desc' },
    select: { portfolioId: true, value: true },
  })
  const snapshotValueMap = new Map<string, number>()
  for (const s of allSnapshots) {
    if (!snapshotValueMap.has(s.portfolioId)) snapshotValueMap.set(s.portfolioId, s.value)
  }

  // TD current value: compute from principal + accrued simple interest using TD parameters
  let tdValue = 0
  for (const p of portfolios) {
    if (p.portfolioType !== 'TERM_DEPOSIT') continue
    if (p.tdPrincipal && p.tdRate && p.tdStartDate && p.tdMaturityDate) {
      tdValue += calcTermDeposit(p.tdPrincipal, p.tdRate, p.tdStartDate, p.tdMaturityDate).currentValue
    } else {
      tdValue += snapshotValueMap.get(p.id) ?? 0
    }
  }

  const sharesValue = portfolios
    .filter((p) => p.portfolioType !== 'TERM_DEPOSIT')
    .reduce((sum, p) => sum + (snapshotValueMap.get(p.id) ?? 0), 0)

  // Apply ownership % to both asset and liability sides so equity is correct
  const propertyEquity = properties.reduce(
    (sum, p) =>
      sum + (p.currentValue - (p.mortgage?.currentBalance ?? 0)) * (p.ownershipPct / 100),
    0
  )
  const propertyDebt = properties.reduce(
    (sum, p) => sum + (p.mortgage?.currentBalance ?? 0) * (p.ownershipPct / 100),
    0
  )
  const propertyGrossValue = properties.reduce(
    (sum, p) => sum + p.currentValue * (p.ownershipPct / 100),
    0
  )
  const superBalance = superAccounts.reduce((sum, a) => sum + a.currentBalance, 0)
  const cashBalance = cashAccounts.reduce((sum, a) => sum + a.balance, 0)

  const snap: WealthSnapshot = {
    sharesValue,
    tdValue,
    propertyEquity,
    superBalance,
    cashBalance,
    propertyDebt,
    propertyGrossValue,
  }

  const effectiveSettings = fireSettings ?? {
    includePropertyEquity: true,
    includeSuper: true,
    includeCash: true,
  }

  // Compute current age from year of birth
  const currentAge = fireSettings
    ? new Date().getFullYear() - fireSettings.yearOfBirth
    : 0

  // For FIRE projection: investable NW excludes super (super is projected separately)
  // Super has its own growth rate, so we track it independently
  const investableNW = computeNetWorth(snap, { ...effectiveSettings, includeSuper: false })
  const superForFire = effectiveSettings.includeSuper ? superBalance : 0
  const currentNetWorth = investableNW + superForFire

  // Compute projection if settings exist
  let projection = null
  let bridge: import('@/lib/wealth').BridgeAnalysis | null = null
  let series: { month: number; value: number; withoutContributions: number }[] = []

  if (fireSettings) {
    const lumpSums = inheritancesToLumpSums(inheritances, new Date().getFullYear())
    const inputs: FireInputs = {
      annualExpenses: fireSettings.annualExpenses,
      withdrawalRate: fireSettings.withdrawalRate,
      expectedReturn: fireSettings.expectedReturn,
      inflationRate: fireSettings.inflationRate,
      superGrowthRate: fireSettings.superGrowthRate,
      monthlySavings: fireSettings.monthlySavings,
      superBalance: superForFire,
      currentAge,
      targetRetireAge: fireSettings.targetRetireAge ?? null,
      lumpSums,
    }

    projection = computeFireProjection(investableNW, inputs)
    series = generateProjectionSeries(investableNW, projection.fireNumber, inputs)
    bridge = computeBridgeToFire(investableNW, inputs, projection.fireNumber)
  }

  const fireProgress =
    projection && projection.fireNumber > 0
      ? Math.min(100, (currentNetWorth / projection.fireNumber) * 100)
      : null

  // Serialize fireSettings for client component
  const initialFormValues = fireSettings
    ? {
        annualExpenses: fireSettings.annualExpenses.toString(),
        withdrawalRate: fireSettings.withdrawalRate.toString(),
        expectedReturn: fireSettings.expectedReturn.toString(),
        inflationRate: fireSettings.inflationRate.toString(),
        superGrowthRate: fireSettings.superGrowthRate.toString(),
        monthlySavings: fireSettings.monthlySavings.toString(),
        yearOfBirth: fireSettings.yearOfBirth.toString(),
        targetRetireAge: fireSettings.targetRetireAge?.toString() ?? '',
        includeSuper: fireSettings.includeSuper,
        includePropertyEquity: fireSettings.includePropertyEquity,
        includeCash: fireSettings.includeCash,
        notes: fireSettings.notes ?? '',
      }
    : undefined

  // Format fire date as string
  const projectedFireDateStr = projection?.projectedFireDate
    ? projection.projectedFireDate.toLocaleDateString('en-AU', {
        month: 'long',
        year: 'numeric',
      })
    : null

  const monthsToFire = projection?.monthsToFire ?? null
  const yearsToFire =
    monthsToFire !== null ? (monthsToFire / 12).toFixed(1) : null

  // Bridge card display logic
  const showBridge = bridge !== null && projection !== null && inheritances.length > 0
  const bridgeEnablesFire = bridge !== null &&
    bridge.naturalFireMonth === null && bridge.fireWithInheritanceMonth !== null
  const bridgeAccelerates = bridge?.accelerates === true
  const bridgeTooLate = bridge !== null &&
    bridge.naturalFireMonth !== null && !bridge.accelerates && bridge.monthsEarlier <= 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/wealth" className="hover:text-indigo-600">Wealth</Link>
          <span>/</span>
          <span>FIRE Planner</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">FIRE Planner</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Financial Independence, Retire Early — track your path to freedom
        </p>
      </div>

      {/* If no settings, show prompt */}
      {!fireSettings && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800 font-medium">
            Set up your FIRE settings below to see projections and your target date.
          </p>
        </Card>
      )}

      {/* Key Stats */}
      {projection && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              FIRE Number
            </p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">
              {formatCurrency(projection.fireNumber)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {fireSettings!.withdrawalRate}% withdrawal rate
            </p>
          </Card>

          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Current Net Worth
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(currentNetWorth)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Investable assets</p>
          </Card>

          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Projected FIRE
            </p>
            {monthsToFire === 0 ? (
              <p className="text-xl font-bold text-green-700 mt-1">Already FIRE!</p>
            ) : projectedFireDateStr ? (
              <>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {projectedFireDateStr}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {yearsToFire} years away
                </p>
              </>
            ) : (
              <p className="text-lg font-semibold text-gray-500 mt-1">
                Not reachable in 50 yrs
              </p>
            )}
          </Card>

          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Projected FIRE Age
            </p>
            {projection.projectedFireAge != null ? (
              <>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {projection.projectedFireAge.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Real return: {projection.realReturn.toFixed(2)}% p.a.
                </p>
              </>
            ) : (
              <p className="text-lg font-semibold text-gray-500 mt-1">—</p>
            )}
          </Card>
        </div>
      )}

      {/* Progress bar */}
      {projection && fireProgress !== null && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Progress to FIRE Number
            </h2>
            <span className="text-lg font-bold text-indigo-600">
              {fireProgress.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-indigo-600 h-4 rounded-full transition-all relative"
              style={{ width: `${fireProgress}%` }}
            >
              {fireProgress > 15 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-xs font-medium">
                  {fireProgress.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1.5">
            <span>{formatCurrency(currentNetWorth)}</span>
            <span>{formatCurrency(projection.fireNumber)}</span>
          </div>
        </Card>
      )}

      {/* Bridge-to-FIRE card */}
      {showBridge && bridge && projection && (
        <Card className={
          bridgeEnablesFire ? 'border-green-300 bg-green-50' :
          bridgeAccelerates ? 'border-green-200 bg-green-50' :
          bridgeTooLate ? 'border-indigo-200 bg-indigo-50' :
          'border-amber-200 bg-amber-50'
        }>
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">
              {bridgeEnablesFire || bridgeAccelerates ? '🌉' : bridgeTooLate ? '✅' : '⚠️'}
            </span>
            <div className="flex-1">
              {bridgeEnablesFire ? (
                // Case: without inheritance you can never FIRE, but WITH it you can
                <>
                  <h2 className="text-sm font-semibold text-green-800">
                    Inheritance makes FIRE possible!
                  </h2>
                  <p className="text-xs text-green-700 mt-1">
                    Continuing to save, you reach FIRE in{' '}
                    <strong>{fmtMonths(bridge.fireWithInheritanceMonth!)}</strong> when the inheritance arrives.
                    Without it, FIRE isn&apos;t reachable within 50 years at your current savings rate.
                  </p>
                </>
              ) : bridgeAccelerates ? (
                // Case: inheritance lets you FIRE sooner than you otherwise would
                <>
                  <h2 className="text-sm font-semibold text-green-800">
                    Inheritance accelerates your FIRE by {fmtMonths(bridge.monthsEarlier)}
                  </h2>
                  <p className="text-xs text-green-700 mt-1">
                    Continuing to save and invest, you&apos;d naturally reach FIRE in{' '}
                    <strong>{fmtMonths(bridge.naturalFireMonth!)}</strong>.
                    With the inheritance, that becomes{' '}
                    <strong>{fmtMonths(bridge.fireWithInheritanceMonth!)}</strong> — {fmtMonths(bridge.monthsEarlier)} sooner.
                  </p>
                </>
              ) : bridgeTooLate ? (
                // Case: you reach FIRE before the inheritance arrives
                <>
                  <h2 className="text-sm font-semibold text-indigo-800">
                    Inheritance arrives after your natural FIRE date
                  </h2>
                  <p className="text-xs text-indigo-700 mt-1">
                    You&apos;re on track to FIRE in <strong>{fmtMonths(bridge.naturalFireMonth!)}</strong> through savings alone.
                    The inheritance will be a welcome bonus when it arrives.
                  </p>
                </>
              ) : (
                // Case: inheritance helps but you still can't reach FIRE
                <>
                  <h2 className="text-sm font-semibold text-amber-800">Inheritance isn&apos;t enough to bridge to FIRE</h2>
                  {bridge.combinedAtInheritance !== null && (
                    <p className="text-xs text-amber-700 mt-1">
                      Even after the inheritance arrives, your accumulated portfolio would be{' '}
                      <strong>{formatCurrency(bridge.combinedAtInheritance)}</strong> — still{' '}
                      <strong>{formatCurrency(bridge.shortfallAtInheritance ?? 0)}</strong> short of the {formatCurrency(projection.fireNumber)} FIRE number.
                      Keep increasing savings or returns to close the gap.
                    </p>
                  )}
                </>
              )}

              {/* Portfolio breakdown at inheritance arrival */}
              {bridge.portfolioAtInheritance !== null && !bridgeTooLate && (
                <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-gray-500">Portfolio at arrival</p>
                    <p className="font-semibold text-gray-800">{formatCurrency(bridge.portfolioAtInheritance)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">+ Inheritance</p>
                    <p className="font-semibold text-violet-700">
                      {formatCurrency((bridge.combinedAtInheritance ?? 0) - bridge.portfolioAtInheritance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">= Combined</p>
                    <p className={`font-semibold ${(bridge.combinedAtInheritance ?? 0) >= projection.fireNumber ? 'text-green-700' : 'text-amber-700'}`}>
                      {formatCurrency(bridge.combinedAtInheritance ?? 0)}
                    </p>
                  </div>
                </div>
              )}

              {/* Inheritance list */}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                {inheritances.map((item) => {
                  const effective = item.amount * (item.probability / 100)
                  return (
                    <span key={item.id} className="flex items-center gap-1">
                      <span>🎁</span>
                      <span>{item.name} — {formatCurrency(effective)}</span>
                      <span className="text-gray-400">({item.expectedYear})</span>
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Target age analysis */}
      {projection &&
        fireSettings?.targetRetireAge &&
        projection.valueAtTargetAge !== null && (
          <Card>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">
                  At age {fireSettings.targetRetireAge}
                </h2>
                <p className="text-xs text-gray-500">
                  Projected net worth vs FIRE number
                </p>
              </div>
              <div className="flex items-center gap-6 ml-auto flex-wrap">
                <div>
                  <p className="text-xs text-gray-500">Projected Value</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(projection.valueAtTargetAge)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">FIRE Number</p>
                  <p className="text-xl font-bold text-indigo-700">
                    {formatCurrency(projection.fireNumber)}
                  </p>
                </div>
                <div>
                  {projection.shortfallAtTargetAge === 0 ? (
                    <Badge variant="green">On track!</Badge>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">Shortfall</p>
                      <p className="text-xl font-bold text-red-600">
                        {formatCurrency(projection.shortfallAtTargetAge ?? 0)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

      {/* Projection Chart */}
      {series.length > 0 && projection && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Net Worth Projection
          </h2>
          <FireProjectionChart
            series={series}
            fireNumber={projection.fireNumber}
            currency="AUD"
          />
        </Card>
      )}

      {/* Settings Form */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {fireSettings ? 'FIRE Settings' : 'Set Up FIRE Settings'}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Configure your retirement targets and assumptions.
        </p>
        <FireSettingsForm initialValues={initialFormValues} />
      </Card>

      {/* Anticipated Inheritances in FIRE */}
      {inheritances.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Anticipated Inheritances</h2>
            <Link href="/wealth/inheritance" className="text-xs text-indigo-500 hover:underline">Manage →</Link>
          </div>
          <div className="space-y-2">
            {inheritances.map((item) => {
              const effective = item.amount * (item.probability / 100)
              const yearsUntil = item.expectedYear - new Date().getFullYear()
              return (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    🎁 {item.name}
                    <span className="ml-2 text-xs text-gray-400">
                      {item.expectedYear}
                      {yearsUntil > 0 ? ` (in ${yearsUntil} yr${yearsUntil !== 1 ? 's' : ''})` : ''}
                      {item.probability < 100 ? ` · ${item.probability}% likely` : ''}
                    </span>
                  </span>
                  <span className="font-semibold text-violet-700">{formatCurrency(effective)}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            These lump sums are injected into the projection at their expected year.
          </p>
        </Card>
      )}

      {/* Current Wealth Snapshot */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Current Wealth Snapshot
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <SnapItem label="Shares" value={formatCurrency(sharesValue)} color="indigo" />
          <SnapItem label="Term Deposits" value={formatCurrency(tdValue)} color="violet" />
          <SnapItem
            label="Property Equity"
            value={formatCurrency(propertyEquity)}
            color="emerald"
            included={effectiveSettings.includePropertyEquity}
          />
          <SnapItem
            label="Super"
            value={formatCurrency(superBalance)}
            color="amber"
            included={effectiveSettings.includeSuper}
            note={fireSettings ? `${fireSettings.superGrowthRate}% growth` : undefined}
          />
          <SnapItem
            label="Cash"
            value={formatCurrency(cashBalance)}
            color="sky"
            included={effectiveSettings.includeCash}
          />
        </div>
      </Card>
    </div>
  )
}

function SnapItem({
  label,
  value,
  color,
  included = true,
  note,
}: {
  label: string
  value: string
  color: string
  included?: boolean
  note?: string
}) {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    sky: 'text-sky-700',
    violet: 'text-violet-700',
  }
  return (
    <div className={included ? '' : 'opacity-40'}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${colorMap[color] ?? 'text-gray-900'}`}>
        {value}
      </p>
      {!included && (
        <p className="text-xs text-gray-400">excluded</p>
      )}
      {included && note && (
        <p className="text-xs text-gray-400">{note}</p>
      )}
    </div>
  )
}
