# MyFi Planner

> Your complete financial picture, self-hosted and private.

MyFi Planner is a personal finance app built for Australians who want full visibility of their wealth — shares, super, property, cash, and budget — without handing their data to a third party. Run it yourself, invite your family, and actually understand where you stand financially.

---

## Why MyFi Planner?

Most finance apps either connect to your bank (storing your credentials on someone else's server), charge a monthly subscription, or only track one thing. MyFi Planner is different:

- **Self-hosted** — your financial data stays on your own machine
- **No subscriptions** — run it forever for free
- **Family-ready** — invite partners, family members, or friends; everyone gets their own private account
- **Australian-first** — ASX prices, AUD, franking credits, superannuation, FIRE planning built around Australian tax and super rules
- **Everything in one place** — shares, property, super, cash, budget, and FIRE projections all talk to each other

---

## Features

### 📊 Investment Portfolio Tracker

Track every buy, sell, and dividend across multiple portfolios. MyFi Planner pulls live and historical prices from Yahoo Finance so you always know what your holdings are worth.

- Real-time prices with automatic daily sync
- Historical value charts per portfolio
- Capital gains tracking with average cost basis
- Dividend income with franking credits and grossed-up amounts
- Multiple portfolios — separate your personal account, partner's account, SMSF
- Import transactions by forwarding broker confirmation emails, or enter them manually
- CSV export for your records or tax time

### 🏠 Wealth Dashboard

One screen showing your complete financial picture: what you own, what you owe, and how it has changed over time. The net worth history chart is built from your actual data — portfolio prices, dated super balance entries, and property valuations — not just dashboard visits.

Asset classes tracked:
- Investment portfolios (live market prices)
- Superannuation balances (with dated history for graphing)
- Properties (with value history and capital gain)
- Cash accounts and savings (with dated balance history)
- Mortgages and liabilities

### 🦘 Superannuation

Super is often your largest asset and the hardest to track. Record your balance at any point in time and graph it to see your fund's actual performance over the years.

- Record balances at any date — build a history over months and years
- Separate super growth rate (typically 8–10%) from your investment return
- Feeds directly into your FIRE projections

### 🏡 Property

Track the value of your properties over time, not just what you paid. Record a valuation whenever you get one — bank revaluation, real estate agent estimate, or CoreLogic — and watch your equity grow.

- Value history with chart
- Capital gain (current value vs purchase price)
- Mortgage balance tracking
- Partial ownership support for jointly held properties

### 🔥 FIRE Planner

Answer the question every Australian investor wants to know: *when can I stop working?*

Enter your target annual spend, expected return, and super growth rate. MyFi Planner projects your portfolio forward month by month — showing the exact month you hit your FIRE number.

- Super modelled separately at its own growth rate
- Inheritance and windfall modelling — see if an expected inheritance brings your FIRE date forward
- Bridge analysis — models what happens if you inherit after you have already retired
- Inflation-adjusted projections
- Configurable withdrawal rate, return rate, and inflation

### 📋 Budget

Know where your money is actually going. Set a monthly budget per category and enter what you actually spent. MyFi Planner shows you the gap.

Comes pre-loaded with 23 sensible Australian default categories:
- Mortgage / Rent, Groceries, Electricity & Gas, Water & Rates
- Health Insurance (PHI), Medical & Dental
- Fuel, Registration & CTP, Public Transport
- Voluntary Super, Emergency Fund, Investments
- Holidays, Home Maintenance, and more

What you get:
- Monthly budget and actual entry — one screen, one save
- Rows turn red when you go over budget as you type
- Budget vs actual bar chart showing every category at a glance
- Spending breakdown donut chart by group
- 12-month trend to see if you are improving over time

### 🤖 AI Financial Assistant

Ask questions about your own finances in plain English. The AI knows your portfolio, net worth, FIRE progress, and budget — giving contextual answers, not generic advice.

*"Am I on track to retire at 55?"*
*"Which of my holdings has the best return this year?"*
*"How much did I spend on dining out last quarter?"*

Bring your own API key for Claude, GPT-4, or Gemini. Keys are stored per-user and never shared.

### 🔔 Price Alerts

Set a target price on any stock and get notified when it crosses the threshold — useful for watching stocks you want to buy, or protecting positions you hold.

### 🎨 Themes

Switch between light and dark mode, and choose from 8 colour themes:
Classic Indigo, Wall Street Gold, Bull Market Emerald, Fox Orange, Dolphin Cyan, Flamingo Rose, Night Owl Violet, Wolf Slate.

---

## Getting Started

MyFi Planner runs as a single Docker Compose stack. You need Docker installed and a domain pointed at your machine.

### 1. Clone the repo

```bash
git clone https://github.com/ben0551/myfi-planner.git
cd myfi-planner
cp .env.example .env
```

### 2. Edit `.env`

```env
# Generate with: openssl rand -base64 32
AUTH_SECRET="your-random-secret-here"

DOMAIN="myfi.yourdomain.com"
DB_PASSWORD="pick-a-strong-password"

ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="your-admin-password"
```

### 3. Build and start

```bash
docker compose up -d --build
```

The database schema is created automatically on first boot and the admin account is seeded. Visit your domain and log in.

### 4. Invite family or friends

Go to **Admin** (in the user menu, top right) to manage accounts. Share your URL — others can register themselves and you approve their account before they can log in.

---

## Backup and Restore

```bash
# Backup
docker compose exec db pg_dump -U myfi myfi > myfi-backup-$(date +%Y%m%d).sql

# Restore
docker compose exec -T db psql -U myfi myfi < myfi-backup-20250101.sql
```

---

## FAQ

**Is my data private?**
Yes. Everything runs on your own hardware. The only outbound calls are Yahoo Finance for stock prices and whichever AI provider you configure — and only when you use the AI chat.

**Can my partner or family members use it?**
Yes. Each person has their own account with completely separate, private data. You control who can sign up.

**Does it work for non-ASX stocks?**
Mostly yes — Yahoo Finance covers most global exchanges. The app is designed around ASX tickers but international holdings work fine.

**What if I skip the AI key?**
The AI Chat feature will show a prompt to configure a key. Everything else works normally.

**Do I need a domain?**
Not strictly — you can run it on your local network by IP address. A domain gives you HTTPS via Let's Encrypt through Traefik.

---

## Roadmap

- [ ] CSV bulk import for transactions
- [ ] Bank feed integration (read-only)
- [ ] Tax report PDF export
- [ ] Shared household view — combined net worth across family accounts

---

*Self-hosted. No subscriptions. Your data stays yours.*
