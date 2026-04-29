# MyFiPlanner

A personal finance tracker built for Australians. Track your investment portfolios, net worth, superannuation, property, and budget — all in one self-hosted app.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)

---

## Features

### 📊 Investment Portfolios
- Track ASX and international stock holdings across multiple portfolios
- Real-time price quotes and historical price charts via Yahoo Finance
- Capital gains, cost basis, and return calculations
- CSV export and email-based transaction import (SMTP ingest)
- Set savings goals with progress tracking

### 💰 Wealth Dashboard
- Live net worth across all asset classes: shares, property, super, cash
- Historical net worth chart reconstructed from actual dated entries — not just daily visits
- Property value tracking with capital gain calculation
- Mortgage tracking

### 🦘 Superannuation
- Track multiple super funds with balance history
- Graph balance growth over time
- Contributions breakdown (employer / employee / voluntary)

### 🔥 FIRE Planner
- Financial Independence / Retire Early projections
- Separate super growth rate (typically 8–10%) from investment return
- Inheritance / windfall modelling ("bridge" analysis)
- Configurable withdrawal rate, inflation, expected return
- Year-of-birth input so age updates automatically each year

### 📋 Budget
- Monthly budgets with 23 sensible Australian default categories
- Income vs expense tracking with actual spend entry
- Budget vs actual bar chart, spending breakdown donut, 12-month trend
- Groups: Income, Living, Transport, Health, Savings, Other
- Over-budget rows highlighted in red

### 🤖 AI Chat
- Chat with Claude, GPT-4, or Gemini about your finances
- Context-aware: the AI knows your portfolio, net worth, and FIRE progress
- Bring your own API key (stored per-user, never shared)

### 🔔 Alerts
- Price alerts: notify when a stock crosses a target price
- Email notifications

### 👥 Multi-user
- Invite family or friends to create their own accounts
- Each user has fully isolated data
- Admin panel for user management and price sync

### 🎨 Themes
- Light / dark mode
- 8 colour themes: Classic Indigo, Wall Street Gold, Bull Market Emerald, Fox Orange, Dolphin Cyan, Flamingo Rose, Night Owl Violet, Wolf Slate

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | NextAuth.js (credentials) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| AI | Anthropic / OpenAI / Google Gemini |
| Deployment | Docker + Traefik |

---

## Deployment

### Prerequisites
- Docker + Docker Compose
- Traefik reverse proxy running with `traefik_proxy` external network
- A domain pointed at your server

### 1. Clone and configure

```bash
git clone https://github.com/ben0551/myfi-planner.git
cd myfi-planner
cp .env.example .env
```

Edit `.env`:

```env
AUTH_SECRET="$(openssl rand -base64 32)"
DOMAIN="myfi.yourdomain.com"
DB_PASSWORD="a-strong-password"
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="your-admin-password"
```

### 2. Create the Traefik network (if it doesn't exist)

```bash
docker network create traefik_proxy
```

### 3. Build and start

```bash
docker compose up -d --build
```

On first boot, the database schema is created automatically (`prisma db push`) and the admin account is seeded.

### 4. Access

Navigate to `https://myfi.yourdomain.com` and log in with your admin credentials.

---

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit DATABASE_URL to point to a local PostgreSQL instance

# Push schema to DB
npx prisma db push

# Start dev server
npm run dev
```

App runs at `http://localhost:3000`.

---

## Email Import

MyFiPlanner runs a lightweight SMTP server on port 2525. Forward broker confirmation emails to this port and transactions are automatically parsed into pending imports for review.

---

## Backup

```bash
# Dump the database
docker compose exec db pg_dump -U myfi myfi > backup.sql

# Restore
docker compose exec -T db psql -U myfi myfi < backup.sql
```

---

## License

MIT
