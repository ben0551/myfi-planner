import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getOwnedProperty(id: string, userId: string) {
  const property = await prisma.property.findUnique({ where: { id } })
  if (!property) return null
  if (property.userId !== userId) return null
  return property
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: propertyId } = await params
  const owned = await getOwnedProperty(propertyId, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const {
    lender,
    originalAmount,
    currentBalance,
    interestRate,
    loanType,
    repaymentAmount,
    repaymentFreq,
    startDate,
    termYears,
    notes,
  } = body

  const mortgage = await prisma.mortgage.upsert({
    where: { propertyId },
    create: {
      propertyId,
      userId: session.user.id,
      lender,
      originalAmount,
      currentBalance,
      interestRate,
      loanType,
      repaymentAmount,
      repaymentFreq,
      startDate: new Date(startDate),
      termYears,
      currency: owned.currency,
      notes,
    },
    update: {
      lender,
      originalAmount,
      currentBalance,
      interestRate,
      loanType,
      repaymentAmount,
      repaymentFreq,
      startDate: startDate ? new Date(startDate) : undefined,
      termYears,
      notes,
    },
  })
  return Response.json(mortgage)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: propertyId } = await params
  const owned = await getOwnedProperty(propertyId, session.user.id)
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 })

  const existing = await prisma.mortgage.findUnique({ where: { propertyId } })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.mortgage.delete({ where: { propertyId } })
  return new Response(null, { status: 204 })
}
