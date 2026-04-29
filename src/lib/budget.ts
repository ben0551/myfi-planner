export const BUDGET_GROUPS = ['INCOME', 'LIVING', 'TRANSPORT', 'HEALTH', 'SAVINGS', 'OTHER'] as const
export type BudgetGroup = (typeof BUDGET_GROUPS)[number]

export const GROUP_LABELS: Record<BudgetGroup, string> = {
  INCOME: 'Income',
  LIVING: 'Living',
  TRANSPORT: 'Transport',
  HEALTH: 'Health',
  SAVINGS: 'Savings',
  OTHER: 'Other',
}

export const GROUP_ICONS: Record<BudgetGroup, string> = {
  INCOME: '💵',
  LIVING: '🏠',
  TRANSPORT: '🚗',
  HEALTH: '🏥',
  SAVINGS: '💰',
  OTHER: '📦',
}

export const GROUP_COLORS: Record<BudgetGroup, string> = {
  INCOME: '#10b981',
  LIVING: '#6366f1',
  TRANSPORT: '#f59e0b',
  HEALTH: '#ec4899',
  SAVINGS: '#06b6d4',
  OTHER: '#94a3b8',
}

export function formatBudgetPeriod(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
  })
}

export function currentYearMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export interface BudgetRow {
  categoryId: string
  name: string
  group: BudgetGroup
  icon: string | null
  budgeted: number
  actual: number
  notes: string | null
}

export interface BudgetGroupSummary {
  group: BudgetGroup
  label: string
  budgeted: number
  actual: number
  rows: BudgetRow[]
}

export interface BudgetSummary {
  groups: BudgetGroupSummary[]
  totalIncomeBudgeted: number
  totalIncomeActual: number
  totalExpenseBudgeted: number
  totalExpenseActual: number
  surplus: number  // income actual - expense actual
}

export function computeBudgetSummary(rows: BudgetRow[]): BudgetSummary {
  const groupMap = new Map<BudgetGroup, BudgetGroupSummary>()

  for (const row of rows) {
    if (!groupMap.has(row.group)) {
      groupMap.set(row.group, {
        group: row.group,
        label: GROUP_LABELS[row.group] ?? row.group,
        budgeted: 0,
        actual: 0,
        rows: [],
      })
    }
    const g = groupMap.get(row.group)!
    g.budgeted += row.budgeted
    g.actual += row.actual
    g.rows.push(row)
  }

  // Order by BUDGET_GROUPS order
  const groups = BUDGET_GROUPS.flatMap((g) => (groupMap.has(g) ? [groupMap.get(g)!] : []))

  const incomeGroups = groups.filter((g) => g.group === 'INCOME')
  const expenseGroups = groups.filter((g) => g.group !== 'INCOME')

  const totalIncomeBudgeted = incomeGroups.reduce((s, g) => s + g.budgeted, 0)
  const totalIncomeActual = incomeGroups.reduce((s, g) => s + g.actual, 0)
  const totalExpenseBudgeted = expenseGroups.reduce((s, g) => s + g.budgeted, 0)
  const totalExpenseActual = expenseGroups.reduce((s, g) => s + g.actual, 0)
  const surplus = totalIncomeActual - totalExpenseActual

  return {
    groups,
    totalIncomeBudgeted,
    totalIncomeActual,
    totalExpenseBudgeted,
    totalExpenseActual,
    surplus,
  }
}

// Default Australian budget categories for first-time setup
export const AU_DEFAULT_CATEGORIES: { name: string; group: BudgetGroup; icon: string; sortOrder: number }[] = [
  { name: 'Salary / Wages', group: 'INCOME', icon: '💼', sortOrder: 0 },
  { name: 'Other Income', group: 'INCOME', icon: '💵', sortOrder: 1 },
  { name: 'Mortgage / Rent', group: 'LIVING', icon: '🏠', sortOrder: 0 },
  { name: 'Groceries', group: 'LIVING', icon: '🛒', sortOrder: 1 },
  { name: 'Electricity & Gas', group: 'LIVING', icon: '⚡', sortOrder: 2 },
  { name: 'Water & Rates', group: 'LIVING', icon: '💧', sortOrder: 3 },
  { name: 'Internet & Phone', group: 'LIVING', icon: '📱', sortOrder: 4 },
  { name: 'Dining & Takeaway', group: 'LIVING', icon: '🍽️', sortOrder: 5 },
  { name: 'Entertainment', group: 'LIVING', icon: '🎬', sortOrder: 6 },
  { name: 'Clothing', group: 'LIVING', icon: '👕', sortOrder: 7 },
  { name: 'Subscriptions', group: 'LIVING', icon: '📺', sortOrder: 8 },
  { name: 'Fuel', group: 'TRANSPORT', icon: '⛽', sortOrder: 0 },
  { name: 'Registration & CTP', group: 'TRANSPORT', icon: '🚗', sortOrder: 1 },
  { name: 'Public Transport', group: 'TRANSPORT', icon: '🚌', sortOrder: 2 },
  { name: 'Health Insurance (PHI)', group: 'HEALTH', icon: '🏥', sortOrder: 0 },
  { name: 'Medical & Dental', group: 'HEALTH', icon: '🦷', sortOrder: 1 },
  { name: 'Gym & Fitness', group: 'HEALTH', icon: '💪', sortOrder: 2 },
  { name: 'Emergency Fund', group: 'SAVINGS', icon: '🛡️', sortOrder: 0 },
  { name: 'Investments', group: 'SAVINGS', icon: '📈', sortOrder: 1 },
  { name: 'Voluntary Super', group: 'SAVINGS', icon: '🦘', sortOrder: 2 },
  { name: 'Holidays', group: 'OTHER', icon: '✈️', sortOrder: 0 },
  { name: 'Gifts & Donations', group: 'OTHER', icon: '🎁', sortOrder: 1 },
  { name: 'Home Maintenance', group: 'OTHER', icon: '🔧', sortOrder: 2 },
]
