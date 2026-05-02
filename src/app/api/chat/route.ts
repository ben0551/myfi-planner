import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { computePortfolioPerformance } from '@/lib/calculations'
import { computeNetWorth } from '@/lib/wealth'
import { streamChat, type AIConfig, type Provider } from '@/lib/ai/provider'

async function buildContext(userId: string): Promise<string> {
  const [portfolios, properties, superAccounts, cashAccounts, fireSettings] = await Promise.all([
    prisma.portfolio.findMany({
      where: { userId },
      include: { transactions: { orderBy: { date: 'asc' } } },
    }),
    prisma.property.findMany({ where: { userId, soldDate: null }, include: { mortgage: true } }),
    prisma.superAccount.findMany({ where: { userId } }),
    prisma.cashAccount.findMany({ where: { userId } }),
    prisma.fireSettings.findUnique({ where: { userId } }),
  ])

  const sections: string[] = []

  // Portfolio performance
  for (const portfolio of portfolios) {
    const tickers = [...new Set(portfolio.transactions.map((t) => t.ticker.toUpperCase()))]
    const priceMap = await getCachedAsxQuotes(tickers)
    const perf = computePortfolioPerformance(
      portfolio.id, portfolio.name, portfolio.currency, portfolio.transactions, priceMap
    )

    sections.push(`## Portfolio: ${portfolio.name} (${portfolio.currency})
Total Invested: $${perf.totalInvested.toFixed(2)}
Current Market Value: $${perf.currentMarketValue.toFixed(2)}
Unrealised Gain: $${perf.unrealisedGain.toFixed(2)} (${perf.unrealisedGainPct.toFixed(2)}%)
Realised Gain: $${perf.realisedGain.toFixed(2)}
Dividends Received: $${perf.dividendsReceived.toFixed(2)}
Total Return: $${perf.totalReturn.toFixed(2)} (${perf.totalReturnPct.toFixed(2)}%)

Holdings:
${perf.holdings.map((h) =>
  `  ${h.ticker}: ${h.quantity} shares @ avg cost $${h.avgCost.toFixed(3)}, current price $${h.currentPrice?.toFixed(3) ?? 'N/A'}, value $${h.currentValue?.toFixed(2) ?? 'N/A'}, unrealised ${h.unrealisedGain != null ? `$${h.unrealisedGain.toFixed(2)} (${h.unrealisedGainPct?.toFixed(2)}%)` : 'N/A'}`
).join('\n')}`)
  }

  // Properties
  if (properties.length > 0) {
    const propLines = properties.map((p) => {
      const equity = p.currentValue * (p.ownershipPct / 100) - (p.mortgage?.currentBalance ?? 0)
      const lvr = p.mortgage ? (p.mortgage.currentBalance / p.currentValue * 100).toFixed(1) : null
      return `  ${p.name} (${p.type}): value $${p.currentValue.toLocaleString()}, equity $${equity.toLocaleString()}${lvr ? `, LVR ${lvr}%` : ''}${p.mortgage ? `, mortgage $${p.mortgage.currentBalance.toLocaleString()} @ ${p.mortgage.interestRate}%` : ''}`
    })
    sections.push(`## Properties\n${propLines.join('\n')}`)
  }

  // Super
  if (superAccounts.length > 0) {
    const superTotal = superAccounts.reduce((s, a) => s + a.currentBalance, 0)
    const superLines = superAccounts.map((a) =>
      `  ${a.fundName}: $${a.currentBalance.toLocaleString()} (employer ${a.employerContribPct}%, employee ${a.employeeContribPct}%)`
    )
    sections.push(`## Superannuation\nTotal: $${superTotal.toLocaleString()}\n${superLines.join('\n')}`)
  }

  // Cash
  if (cashAccounts.length > 0) {
    const cashTotal = cashAccounts.reduce((s, a) => s + a.balance, 0)
    sections.push(`## Cash Accounts\nTotal: $${cashTotal.toLocaleString()}\n${cashAccounts.map((a) => `  ${a.name}${a.institution ? ` (${a.institution})` : ''}: $${a.balance.toLocaleString()}`).join('\n')}`)
  }

  // Net worth
  const propertyEquity = properties.reduce((s, p) => s + p.currentValue * (p.ownershipPct / 100) - (p.mortgage?.currentBalance ?? 0), 0)
  const superBalance = superAccounts.reduce((s, a) => s + a.currentBalance, 0)
  const cashBalance = cashAccounts.reduce((s, a) => s + a.balance, 0)
  const latestSnapshots = await Promise.all(
    portfolios.map((p) => prisma.portfolioSnapshot.findFirst({ where: { portfolioId: p.id }, orderBy: { date: 'desc' } }))
  )
  const sharesValue = latestSnapshots.reduce((s, snap) => s + (snap?.value ?? 0), 0)
  const nwSnap = { sharesValue, tdValue: 0, propertyEquity, superBalance, cashBalance, propertyDebt: 0, propertyGrossValue: 0 }
  const settings = fireSettings ?? { includePropertyEquity: true, includeSuper: true, includeCash: true }
  const netWorth = computeNetWorth(nwSnap, settings)

  sections.push(`## Net Worth Summary\nTotal Net Worth: $${netWorth.toLocaleString()}\n  Shares: $${sharesValue.toLocaleString()}\n  Property Equity: $${propertyEquity.toLocaleString()}\n  Super: $${superBalance.toLocaleString()}\n  Cash: $${cashBalance.toLocaleString()}`)

  // FIRE
  if (fireSettings) {
    const fireNumber = fireSettings.annualExpenses / (fireSettings.withdrawalRate / 100)
    const progress = (netWorth / fireNumber * 100).toFixed(1)
    sections.push(`## FIRE Settings\nAnnual Expenses Target: $${fireSettings.annualExpenses.toLocaleString()}\nWithdrawal Rate: ${fireSettings.withdrawalRate}%\nFIRE Number: $${fireNumber.toLocaleString()}\nProgress: ${progress}%\nExpected Return: ${fireSettings.expectedReturn}%\nMonthly Savings: $${fireSettings.monthlySavings.toLocaleString()}\nCurrent Age: ${new Date().getFullYear() - fireSettings.yearOfBirth}${fireSettings.targetRetireAge ? `\nTarget Retire Age: ${fireSettings.targetRetireAge}` : ''}`)
  }

  return sections.join('\n\n')
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
  }

  // Load AI config from DB, fall back to env
  const aiSettings = await prisma.aISettings.findUnique({ where: { userId: session.user.id } })
  const config: AIConfig = {
    provider: (aiSettings?.provider as Provider) ?? 'anthropic',
    model: aiSettings?.model ?? null,
    apiKey: aiSettings?.apiKey ?? null,
    baseUrl: aiSettings?.baseUrl ?? null,
  }

  const context = await buildContext(session.user.id)
  const systemPrompt = `You are a personal finance assistant for an Australian investor. You have access to their current portfolio data and can help them understand their investments, analyse performance, think through financial decisions, and plan for FIRE (Financial Independence, Retire Early).

Be concise, practical, and specific to their actual numbers. Use Australian context (AUD, ASX, superannuation, CGT discount, franking credits). When discussing tax, remind them to consult a tax professional for advice.

Today's date: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}.

## User's Financial Data
${context}`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(config, messages, systemPrompt)) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error generating response'
        console.error('[chat] stream error:', err)
        controller.enqueue(encoder.encode(`\n\n[${msg}]`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
