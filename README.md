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

Track every buy, sell, dividend, and DRP across multiple portfolios. Live and historical prices from Yahoo Finance. Multiple portfolio types supported.

- Real-time prices with automatic daily sync
- Historical value charts per portfolio
- Capital gains tracking with average cost basis
- Dividend income with per-payment franking credits and grossed-up amounts
- **Auto dividend sync** — pulls 3 years of dividend history from Yahoo Finance into a review inbox, with per-payment franking % fetched per payment
- **Pending inbox** — review, edit, and confirm synced dividends before they hit your ledger; supports cash account crediting and DRP toggle per row
- **Per-ticker DRP flag** — mark a holding as DRP-registered so incoming dividends default to reinvestment
- **Term deposits** — separate portfolio type with principal, rate, term, and accrued interest tracking
- Multiple portfolios — personal account, partner's account, SMSF
- Import transactions by forwarding broker emails, pasting email text, or entering manually
- CSV export for records or tax time

### 🏠 Wealth Dashboard

One screen showing your complete financial picture: what you own, what you owe, and how it has changed over time.

- Net worth history chart built from actual dated data — not just dashboard visits
- Sold properties correctly drop out of history at their sale date
- Mortgage balances amortize through history (P&I formula) rather than showing as a flat line
- Asset breakdown view showing shares, super, property, and cash separately

Asset classes tracked:
- Investment portfolios (live market prices)
- Superannuation balances (with dated history for graphing)
- Properties (with value history, capital gain, mortgage amortization)
- Cash accounts and savings (with dated balance history)
- Mortgages and liabilities

### 🏡 Property

Track residential and investment properties through their full lifecycle.

- Value history with chart
- Capital gain (current value vs purchase price / cost base)
- Mortgage balance amortization — P&I and interest-only supported
- Partial ownership support for jointly held properties
- **Property sale flow** — record sale price, sold date, and optionally credit proceeds to a cash account; mortgage liability is cleared; sold properties still appear in historical net worth up to the sale date
- **Unsell** — reverse a sale, restoring the property, mortgage balance, and cash account to their pre-sale state
- CGT calculation on disposal (with 50% discount for assets held >12 months)

### 💰 Tax Centre

A full Australian tax picture — CGT events, dividend income, and estimated liability — across all portfolios.

- **Capital Gains Tax** — disposals of shares and investment properties, with 50% discount for assets held >12 months, capital losses, and net assessable gain
- **Dividend income** — cash received, franking credits, and grossed-up totals per ticker
- **Estimated dividend tax liability** — select your marginal rate (34.5% / 39% / 47% / 49%) and see gross tax, franking offset, and net payable or franking refund
- Tax-loss harvesting analysis — identifies positions with unrealised losses that could offset your capital gain before 30 June
- Per-portfolio CGT and dividend drill-downs
- PDF export

### 🦘 Superannuation

Record your balance at any point and graph your fund's actual performance over time. Feeds directly into FIRE projections.

### 🔥 FIRE Planner

Answer the question every Australian investor wants to know: *when can I stop working?*

Enter your target annual spend, expected return, and super growth rate. MyFi Planner projects your portfolio forward month by month.

- Super modelled separately at its own growth rate
- Inheritance and windfall modelling — see if an expected inheritance brings your FIRE date forward
- Inflation-adjusted projections
- Configurable withdrawal rate, return rate, and inflation

### 📋 Budget

Set monthly budgets per category and track actual spending. Comes pre-loaded with 23 Australian default categories.

- Budget vs actual bar chart per category
- Spending breakdown donut by group
- 12-month trend

### 📧 Email Import

Import transactions from broker confirmation emails without any integrations or credentials.

- Paste email text directly into the app
- Upload a `.eml` file
- SMTP relay — forward emails from your email client to the local SMTP server (port 2525) for automatic parsing
- Supports Stake, CommSec, and other common broker email formats
- Editable franking %, DRP toggle, and cash account crediting in the review UI

### 🤖 AI Financial Assistant

Ask questions about your own finances in plain English. The AI knows your portfolio, net worth, FIRE progress, and budget.

Bring your own API key for Claude, GPT-4, or Gemini. Keys are stored per-user and never shared.

### 🔔 Price Alerts

Set a target price on any stock and get notified when it crosses the threshold.

### 🎨 Themes

Light and dark mode with 8 colour themes: Classic Indigo, Wall Street Gold, Bull Market Emerald, Fox Orange, Dolphin Cyan, Flamingo Rose, Night Owl Violet, Wolf Slate.

---

## Getting Started

MyFi Planner runs as a single Docker Compose stack.

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

Go to **Admin** (in the user menu, top right) to manage accounts. Share your URL — others can register and you approve their account before they can log in.

---

## Backup and Restore

```bash
# Backup
docker compose exec db pg_dump -U myfi myfi > myfi-backup-$(date +%Y%m%d).sql

# Restore
docker compose exec -T db psql -U myfi myfi < myfi-backup-20250101.sql
```

---

## API

MyFi Planner exposes a REST API used by its own frontend. You can also call it directly with an API key for automation or integration with other tools.

See [API.md](API.md) for the full reference.

---

## FAQ

**Is my data private?**
Yes. Everything runs on your own hardware. The only outbound calls are Yahoo Finance for stock prices, MarketIndex for franking data, and whichever AI provider you configure.

**Can my partner or family members use it?**
Yes. Each person has their own account with completely separate, private data.

**Does it work for non-ASX stocks?**
Mostly yes — Yahoo Finance covers most global exchanges. Franking credits are ASX-specific.

**What if I skip the AI key?**
The AI Chat feature will show a prompt to configure a key. Everything else works normally.

**Do I need a domain?**
Not strictly — you can run it on your local network by IP address. A domain gives you HTTPS via Let's Encrypt through Traefik.

---

## Roadmap

- [x] CSV bulk import for transactions
- [x] Tax report PDF export
- [x] Dividend auto-sync from Yahoo Finance
- [x] Property sale / unsell with CGT and mortgage reversal
- [x] Estimated dividend tax liability with franking offset
- [ ] Bank feed integration (read-only)
- [ ] Shared household view — combined net worth across family accounts
- [ ] Automated franking % per payment from a reliable data source

---

*Self-hosted. No subscriptions. Your data stays yours.*
