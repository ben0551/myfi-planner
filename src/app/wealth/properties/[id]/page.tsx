import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { PropertyForm } from '@/components/wealth/PropertyForm'
import { MortgageForm } from '@/components/wealth/MortgageForm'
import { MortgageChart } from '@/components/wealth/MortgageChart'
import { AssetValueChart } from '@/components/wealth/AssetValueChart'
import { PropertyValueForm } from '@/components/wealth/PropertyValueForm'
import { PropertyValuationHistory } from '@/components/wealth/PropertyValuationHistory'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      mortgage: true,
      valueHistory: { orderBy: { date: 'desc' } },
    },
  })

  if (!property || property.userId !== session.user.id) notFound()

  const equity =
    property.currentValue * (property.ownershipPct / 100) -
    (property.mortgage?.currentBalance ?? 0)
  const lvr =
    property.mortgage && property.currentValue > 0
      ? (property.mortgage.currentBalance / property.currentValue) * 100
      : null

  // Value history stats
  const sortedHistory = [...property.valueHistory].sort((a, b) =>
    a.date.toISOString().localeCompare(b.date.toISOString())
  )
  const firstEntry = sortedHistory[0]
  const growthAmount = firstEntry ? property.currentValue - firstEntry.value : null
  const growthPct =
    firstEntry && firstEntry.value > 0
      ? ((property.currentValue - firstEntry.value) / firstEntry.value) * 100
      : null
  // Capital gain vs purchase price
  const capitalGain = property.currentValue - property.purchasePrice
  const capitalGainPct =
    property.purchasePrice > 0
      ? (capitalGain / property.purchasePrice) * 100
      : null

  const valueHistoryForChart = property.valueHistory.map((h) => ({
    date: h.date.toISOString().split('T')[0],
    value: h.value,
  }))

  // Serialize dates to strings for client components
  const initialPropertyValues = {
    name: property.name,
    address: property.address ?? '',
    type: property.type,
    purchasePrice: property.purchasePrice.toString(),
    purchaseDate: property.purchaseDate.toISOString().split('T')[0],
    currentValue: property.currentValue.toString(),
    ownershipPct: property.ownershipPct.toString(),
    currency: property.currency,
    notes: property.notes ?? '',
  }

  const initialMortgageValues = property.mortgage
    ? {
        lender: property.mortgage.lender,
        originalAmount: property.mortgage.originalAmount.toString(),
        currentBalance: property.mortgage.currentBalance.toString(),
        interestRate: property.mortgage.interestRate.toString(),
        loanType: property.mortgage.loanType,
        repaymentAmount: property.mortgage.repaymentAmount.toString(),
        repaymentFreq: property.mortgage.repaymentFreq,
        startDate: property.mortgage.startDate.toISOString().split('T')[0],
        termYears: property.mortgage.termYears.toString(),
        notes: property.mortgage.notes ?? '',
      }
    : undefined

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/wealth" className="hover:text-indigo-600">Wealth</Link>
          <span>/</span>
          <Link href="/wealth/properties" className="hover:text-indigo-600">Properties</Link>
          <span>/</span>
          <span>{property.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
          <Badge variant="gray">{property.type}</Badge>
          {property.ownershipPct < 100 && (
            <Badge variant="blue">{property.ownershipPct}% owned</Badge>
          )}
        </div>
        {property.address && (
          <p className="text-sm text-gray-500 mt-1">{property.address}</p>
        )}
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Current Value"
          value={formatCurrency(property.currentValue, property.currency)}
        />
        <StatCard
          label="Net Equity"
          value={formatCurrency(equity, property.currency)}
          valueClass="text-emerald-700"
        />
        {property.mortgage && (
          <StatCard
            label="Mortgage Balance"
            value={formatCurrency(property.mortgage.currentBalance, property.currency)}
            valueClass="text-red-600"
          />
        )}
        {lvr !== null && (
          <StatCard
            label="LVR"
            value={`${lvr.toFixed(1)}%`}
            valueClass={lvr > 80 ? 'text-red-600' : lvr > 60 ? 'text-yellow-600' : 'text-green-600'}
          />
        )}
        <StatCard
          label="Purchase Price"
          value={formatCurrency(property.purchasePrice, property.currency)}
        />
        <StatCard label="Purchased" value={formatDate(property.purchaseDate)} />
        <StatCard label="Ownership" value={`${property.ownershipPct}%`} />
        {capitalGain !== null && capitalGainPct !== null && (
          <StatCard
            label="Capital Gain"
            value={`${capitalGain >= 0 ? '+' : ''}${formatCurrency(capitalGain, property.currency)}`}
            valueClass={capitalGain >= 0 ? 'text-emerald-700' : 'text-red-600'}
            sub={`${capitalGainPct >= 0 ? '+' : ''}${capitalGainPct.toFixed(1)}% vs purchase`}
          />
        )}
      </div>

      {/* Value History Chart */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Property Value History</h2>
          {growthAmount !== null && growthPct !== null && (
            <span className={`text-sm font-semibold ${growthAmount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {growthAmount >= 0 ? '+' : ''}{formatCurrency(growthAmount, property.currency)}
              {' '}({growthPct >= 0 ? '+' : ''}{growthPct.toFixed(1)}%)
            </span>
          )}
        </div>
        <AssetValueChart
          history={valueHistoryForChart}
          currency={property.currency}
          color="#10b981"
          fillId="gradProperty"
          valueLabel="Property Value"
          referenceLine={{
            value: property.purchasePrice,
            label: `Purchase $${(property.purchasePrice / 1000).toFixed(0)}k`,
            color: '#9ca3af',
          }}
        />
      </Card>

      {/* Value History Table */}
      {property.valueHistory.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recorded Valuations</h2>
          <PropertyValuationHistory
            propertyId={property.id}
            history={property.valueHistory.map((h) => ({
              id: h.id,
              date: h.date.toISOString(),
              value: h.value,
            }))}
            purchasePrice={property.purchasePrice}
            currency={property.currency}
          />
        </Card>
      )}

      {/* Record Valuation */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Record Valuation</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter an updated market value from an appraisal, recent sale data, or your own estimate.
          This updates the current value used across the app.
        </p>
        <PropertyValueForm
          propertyId={property.id}
          currentValue={property.currentValue}
          currency={property.currency}
        />
      </Card>

      {/* Edit Property */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Property Details</h2>
        <PropertyForm
          propertyId={property.id}
          initialValues={initialPropertyValues}
        />
      </Card>

      {/* Mortgage amortization chart */}
      {property.mortgage && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Loan Paydown</h2>
          <MortgageChart
            mortgage={{
              originalAmount: property.mortgage.originalAmount,
              currentBalance: property.mortgage.currentBalance,
              startDate: property.mortgage.startDate.toISOString(),
              termYears: property.mortgage.termYears,
              interestRate: property.mortgage.interestRate,
              repaymentAmount: property.mortgage.repaymentAmount,
              repaymentFreq: property.mortgage.repaymentFreq,
              loanType: property.mortgage.loanType,
              currency: property.currency,
            }}
          />
        </Card>
      )}

      {/* Mortgage */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {property.mortgage ? 'Mortgage Details' : 'Add Mortgage'}
          </h2>
          {property.mortgage && (
            <div className="text-sm text-gray-500">
              Rate: {property.mortgage.interestRate}% p.a. |{' '}
              {property.mortgage.loanType === 'IO' ? 'Interest Only' : 'Principal & Interest'} |{' '}
              {property.mortgage.termYears} yr term
            </div>
          )}
        </div>
        <MortgageForm
          propertyId={property.id}
          initialValues={initialMortgageValues}
          hasMortgage={Boolean(property.mortgage)}
        />
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  valueClass = 'text-gray-900',
  sub,
}: {
  label: string
  value: string
  valueClass?: string
  sub?: string
}) {
  return (
    <Card>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </Card>
  )
}
