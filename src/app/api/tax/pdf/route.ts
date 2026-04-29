import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeCGTReport, computeDividendReport, currentFY, getFYLabel } from '@/lib/tax'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { TaxReportPDF } from '@/components/tax/TaxReportPDF'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fyYear = parseInt(searchParams.get('fy') ?? String(currentFY()), 10)

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    include: { transactions: { orderBy: { date: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  })

  const perPortfolio = portfolios
    .filter((p) => p.transactions.length > 0)
    .map((p) => ({
      name: p.name,
      currency: p.currency,
      cgt: computeCGTReport(p.transactions, fyYear),
      div: computeDividendReport(p.transactions, fyYear),
    }))

  const currency = portfolios[0]?.currency ?? 'AUD'
  const fyLabel = getFYLabel(fyYear)

  const agg = {
    grossGain: perPortfolio.reduce((s, r) => s + r.cgt.totalGrossGain, 0),
    discountApplied: perPortfolio.reduce((s, r) => s + r.cgt.totalDiscountApplied, 0),
    capitalLosses: perPortfolio.reduce((s, r) => s + r.cgt.totalCapitalLosses, 0),
    netAssessableGain: perPortfolio.reduce((s, r) => s + r.cgt.netAssessableGain, 0),
    cashDividends: perPortfolio.reduce((s, r) => s + r.div.totalCash, 0),
    frankingCredits: perPortfolio.reduce((s, r) => s + r.div.totalFrankingCredits, 0),
    grossedUp: perPortfolio.reduce((s, r) => s + r.div.totalGrossedUp, 0),
  }

  const totalAssessable = agg.netAssessableGain + agg.grossedUp
  const generatedAt = new Date().toLocaleDateString('en-AU', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    createElement(TaxReportPDF, {
      fyLabel,
      fyYear,
      currency,
      agg,
      totalAssessable,
      perPortfolio,
      generatedAt,
    }) as any
  )

  const filename = `myfi-tax-${fyLabel.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
