@AGENTS.md

# MyFi Planner — Codebase Guide

## What this is
Self-hosted Australian personal finance app. Next.js 16 + React 19 + PostgreSQL + Prisma, deployed via Docker Compose with Traefik TLS. Multi-user, family/household sharing, AI assistant, email/CSV import.

## Stack
- **Framework**: Next.js 16 App Router (server + client components)
- **DB**: PostgreSQL via Prisma ORM — `prisma/schema.prisma` has all models
- **Auth**: NextAuth v5 beta (`src/lib/auth.ts`)
- **Styling**: Tailwind CSS 4
- **Tests**: Vitest (`npm test`)
- **Charts**: Recharts
- **AI**: Pluggable — Anthropic / OpenAI / Gemini via `src/lib/ai/provider.ts`

## Key commands
```
npm run dev          # Start dev server (tsx server.ts, ports 3000 + 2525 SMTP)
npm run build        # Production build
npm test             # Vitest unit tests
npm run db:studio    # Prisma Studio
npm run db:migrate   # Apply migrations
npm run db:generate  # Regenerate Prisma client after schema change
```

## Project layout
```
src/
  app/           # Next.js App Router routes (pages + API routes)
  components/    # React components, organised by feature
  lib/           # Business logic, utilities, data access
prisma/
  schema.prisma  # All 48 DB models
  migrations/    # Applied migration files
scripts/         # One-off utilities
server.ts        # Custom server (adds SMTP listener on port 2525)
```

## Route structure
- `/` — dashboard/home
- `/portfolios/[id]` — portfolio detail + `PortfolioActionsMenu`
- `/portfolios/[id]/transactions/import` — CSV/Excel/Paste Email/Upload .eml (tabbed)
- `/portfolios/[id]/inbox` — pending transactions from email import
- `/portfolios/[id]/tax`, `/tax/harvest` — CGT, dividends, tax-loss harvesting
- `/wealth/` — properties, super, cash, FIRE, inheritance
- `/budget/[year]/[month]` — monthly budget
- `/admin/` — user management, sync panel, site settings
- `/chat` — AI financial assistant
- All API routes live under `src/app/api/`

## Key lib files
| File | What it does |
|------|-------------|
| `calculations.ts` | Core portfolio maths (holdings, gains, performance) |
| `tax.ts` | CGT events, dividend tax, FY helpers |
| `snapshots.ts` | Portfolio value snapshots |
| `netWorthSnapshot.ts` | Aggregates all assets for net-worth history |
| `formatters.ts` | Currency, date, gain colour helpers |
| `fx.ts` | ECB FX rates — EUR-pivoted conversion |
| `fmp.ts` | Financial Modeling Prep API (fundamentals) |
| `yahoo.ts` | Yahoo Finance (prices + fundamentals) |
| `asx/cache.ts` | ASX price cache layer |
| `email/` | .eml parsing, paste parsing, broker-specific parsers |
| `auth.ts` | NextAuth config |
| `prisma.ts` | Prisma client singleton (soft-delete extension on Transaction) |
| `schemas.ts` | Zod schemas for API/form validation |
| `crypto.ts` | AES-256-GCM encryption for stored secrets |
| `wealth.ts` | FIRE projections, wealth aggregation |

## Prisma notes
- Soft-delete middleware is scoped to the `Transaction` model only (via `$extends`)
- `prisma migrate dev` for development, `prisma db push` runs on Docker startup
- `?? undefined` in upsert `update:` block = don't overwrite existing value; `null` = wipe it — important distinction in sync routes

## Important patterns
- **Server components** fetch data directly via Prisma; **client components** use SWR or fetch
- `export const dynamic = 'force-dynamic'` on pages that need per-request data
- Admin routes call `requireAdmin()` first — returns a redirect Response or null
- Prices: `getCachedAsxQuotes()` from `asx/cache.ts` — wraps Yahoo/ASX, dedups, caches
- Transaction import: preview mode (`?preview=true`) parses without writing
- Email import flow: email → `PendingTransaction` → user reviews in `/inbox` → approves → becomes `Transaction`

## Portfolio actions menu
`src/components/portfolio/PortfolioActionsMenu.tsx` — client component on the portfolio page.
- Scrollable row: Add Transaction + nav links (History, Analysis, Rebalance, Tax Report, Goals)
- "Actions ▾" dropdown **outside** the scroll container (critical — overflow-x-auto clips absolute children)
- Dropdown: Sync Dividends, Import, Export CSV, Inbox (with badge), Edit Portfolio

## Environment variables
See `.env.example`. Key ones:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — NextAuth secret
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — initial admin account
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` — AI (optional)
- `SMTP_*` — outbound email (password resets)
- `MAILGUN_*` — inbound email import

## Docker / deployment
- `docker-compose.yml` — production with Traefik TLS
- `docker-compose.local.yml` — local dev with PostgreSQL
- `Dockerfile` — multi-stage Node 20 Alpine build
- GitHub Actions (`.github/workflows/docker.yml`) builds and pushes image to ghcr.io on release

## Testing
Unit tests live next to `lib/` files as `*.test.ts`. Run with `npm test`.
Covered: crypto, fx, mortgage, superRates, termDeposit, wealth, tax calculations.
