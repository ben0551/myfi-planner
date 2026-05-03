/**
 * Shared zod schemas for API request validation.
 * Use at every API boundary to reject garbage input early
 * and to give the route handler typed payloads for free.
 */
import { z } from 'zod'

// ── Primitives ───────────────────────────────────────────────────────────────

export const PositiveNumber = z.number().positive().finite()
export const NonNegativeNumber = z.number().nonnegative().finite()
export const Percentage = z.number().min(0).max(100).finite()
export const CurrencyCode = z.string().length(3).regex(/^[A-Z]{3}$/, 'must be 3-letter ISO code')
export const Cuid = z.string().min(1)
export const ISODateString = z.string().refine(
  (v) => !isNaN(new Date(v).getTime()),
  { message: 'must be a valid date string' },
)

// ── Transactions ─────────────────────────────────────────────────────────────

export const TransactionTypeEnum = z.enum(['BUY', 'SELL', 'DIVIDEND', 'DRP'])

export const CreateTransactionSchema = z.object({
  portfolioId: Cuid,
  type: TransactionTypeEnum,
  ticker: z.string().min(1).max(20).transform((s) => s.toUpperCase().trim()),
  date: ISODateString,
  quantity: NonNegativeNumber.default(0),
  price: NonNegativeNumber.default(0),
  fees: NonNegativeNumber.default(0),
  amount: NonNegativeNumber.nullable().optional(),
  frankingPct: Percentage.default(0),
  frankingCredit: NonNegativeNumber.default(0),
  notes: z.string().max(2000).nullable().optional(),
})

export const UpdateTransactionSchema = CreateTransactionSchema.partial().omit({ portfolioId: true })

// ── Portfolios ───────────────────────────────────────────────────────────────

export const PortfolioTypeEnum = z.enum(['SHARES', 'TERM_DEPOSIT'])

export const CreatePortfolioSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  currency: CurrencyCode.default('AUD'),
  portfolioType: PortfolioTypeEnum.default('SHARES'),
  // TD-specific fields
  tdPrincipal: PositiveNumber.optional(),
  tdRate: Percentage.optional(),
  tdTermMonths: z.number().int().positive().optional(),
  tdStartDate: ISODateString.optional(),
  tdMaturityDate: ISODateString.optional(),
  tdInterestFreq: z.enum(['MONTHLY', 'QUARTERLY', 'AT_MATURITY']).optional(),
})

// ── Wealth: Property + Mortgage ──────────────────────────────────────────────

export const PropertyTypeEnum = z.enum(['RESIDENTIAL', 'INVESTMENT', 'LAND', 'COMMERCIAL'])

export const CreatePropertySchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(300).nullable().optional(),
  type: PropertyTypeEnum.default('RESIDENTIAL'),
  purchasePrice: NonNegativeNumber,
  purchaseDate: ISODateString,
  currentValue: NonNegativeNumber,
  ownershipPct: Percentage.default(100),
  currency: CurrencyCode.default('AUD'),
  notes: z.string().max(2000).nullable().optional(),
})

export const LoanTypeEnum = z.enum(['PI', 'IO'])
export const RepaymentFreqEnum = z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'])

export const CreateMortgageSchema = z.object({
  lender: z.string().min(1).max(100),
  originalAmount: PositiveNumber,
  currentBalance: NonNegativeNumber,
  interestRate: NonNegativeNumber,
  loanType: LoanTypeEnum.default('PI'),
  repaymentAmount: NonNegativeNumber,
  repaymentFreq: RepaymentFreqEnum.default('MONTHLY'),
  startDate: ISODateString,
  termYears: z.number().int().positive().max(50),
  currency: CurrencyCode.default('AUD'),
  notes: z.string().max(2000).nullable().optional(),
})

// ── Wealth: Super ────────────────────────────────────────────────────────────

export const CreateSuperSchema = z.object({
  fundName: z.string().min(1).max(100),
  accountNumber: z.string().max(50).nullable().optional(),
  currentBalance: NonNegativeNumber,
  employerContribPct: Percentage.default(11.5),
  employeeContribPct: Percentage.default(0),
  annualSalary: NonNegativeNumber.nullable().optional(),
  maxConcessional: z.boolean().default(false),
  currency: CurrencyCode.default('AUD'),
  notes: z.string().max(2000).nullable().optional(),
})

// ── Wealth: Cash ─────────────────────────────────────────────────────────────

export const CreateCashSchema = z.object({
  name: z.string().min(1).max(100),
  institution: z.string().max(100).nullable().optional(),
  balance: NonNegativeNumber,
  currency: CurrencyCode.default('AUD'),
  notes: z.string().max(2000).nullable().optional(),
  openingDate: ISODateString.optional(),
})

export const RecordBalanceSchema = z.object({
  balance: NonNegativeNumber,
  date: ISODateString.optional(),
})

// ── Wealth: Inheritance ──────────────────────────────────────────────────────

export const CreateInheritanceSchema = z.object({
  name: z.string().min(1).max(100),
  amount: PositiveNumber,
  expectedYear: z.number().int().min(1900).max(2200),
  probability: Percentage.default(100),
  currency: CurrencyCode.default('AUD'),
  notes: z.string().max(2000).nullable().optional(),
  includeInFire: z.boolean().default(true),
})

// ── FIRE settings ────────────────────────────────────────────────────────────

export const FireSettingsSchema = z.object({
  annualExpenses: NonNegativeNumber,
  withdrawalRate: Percentage.default(4),
  expectedReturn: NonNegativeNumber.default(7),
  inflationRate: NonNegativeNumber.default(3),
  superGrowthRate: NonNegativeNumber.default(9),
  monthlySavings: NonNegativeNumber.default(0),
  yearOfBirth: z.number().int().min(1900).max(2200),
  targetRetireAge: z.number().int().min(0).max(120).nullable().optional(),
  includeSuper: z.boolean().default(true),
  includePropertyEquity: z.boolean().default(true),
  includeCash: z.boolean().default(true),
  notes: z.string().max(2000).nullable().optional(),
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a request body against a schema; on failure return a 400 with
 * a flattened error map. Caller pattern:
 *
 *   const result = await parseBody(req, MySchema)
 *   if (!result.ok) return result.response
 *   const data = result.data
 */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return {
      ok: false,
      response: Response.json({ error: 'Invalid JSON body' }, { status: 400 }),
    }
  }
  const result = schema.safeParse(json)
  if (!result.success) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Validation failed', issues: z.treeifyError(result.error) },
        { status: 400 },
      ),
    }
  }
  return { ok: true, data: result.data }
}
