# MyFi Planner — API Reference

All endpoints are under `/api/`. The API is used by the frontend but can also be called directly using an API key.

## Authentication

Every request must be authenticated. Two methods are supported:

**Session cookie** (browser) — handled automatically when logged in.

**API key** — pass your key in the `Authorization` header:

```
Authorization: Bearer <your-api-key>
```

Generate an API key in **Settings → API Key**. Keys are per-user and grant access to that user's data only.

---

## Portfolios

### List portfolios
```
GET /api/portfolios
```
Returns all portfolios owned by the authenticated user.

### Create portfolio
```
POST /api/portfolios
```
```json
{
  "name": "My Shares",
  "description": "Optional",
  "currency": "AUD",
  "portfolioType": "SHARES"
}
```
`portfolioType` is `"SHARES"` (default) or `"TERM_DEPOSIT"`.

### Get / update / delete portfolio
```
GET    /api/portfolios/:id
PUT    /api/portfolios/:id
DELETE /api/portfolios/:id
```

### Portfolio performance
```
GET /api/portfolios/:id/performance
```
Returns holdings, market value, total invested, unrealised gain, and dividends received.

### Sync dividends from Yahoo Finance
```
POST /api/portfolios/:id/sync-dividends
```
Fetches 3 years of dividend history for all held tickers, deduplicates against confirmed transactions (±14 day window), and creates `PendingTransaction` records for review. Returns `{ created, skipped, errors }`.

### Per-ticker DRP settings
```
GET   /api/portfolios/:id/ticker-settings
PATCH /api/portfolios/:id/ticker-settings
```
PATCH body:
```json
{ "ticker": "VAS", "drpEnabled": true }
```
When `drpEnabled` is true, incoming pending dividends for that ticker default to DRP in the inbox.

### Export transactions as CSV
```
GET /api/portfolios/:id/export
```
Returns a CSV file of all transactions.

---

## Transactions

### List transactions
```
GET /api/transactions?portfolioId=<id>
```

### Create transaction
```
POST /api/transactions
```
```json
{
  "portfolioId": "...",
  "type": "BUY",
  "ticker": "VAS",
  "date": "2024-07-01",
  "quantity": 50,
  "price": 98.45,
  "fees": 9.95,
  "frankingPct": 0,
  "notes": "Optional"
}
```

**Types:** `BUY` | `SELL` | `DIVIDEND` | `DRP`

For `DIVIDEND`: provide `amount` (total cash received) and `frankingPct` (0–100). `quantity` and `price` are ignored.

For `DRP`: provide `quantity` (shares received), `price` (DRP price per share), and optionally `amount` (defaults to `quantity × price`).

### Update / delete transaction
```
PUT    /api/transactions/:id
DELETE /api/transactions/:id
```

---

## Pending Transactions

Pending transactions are a staging area — created by email import or dividend sync, confirmed or rejected by the user before becoming real transactions.

### List pending transactions
```
GET /api/pending-transactions?status=PENDING
```

### Create pending transaction (manual / email paste)
```
POST /api/pending-transactions
```

### Confirm or reject
```
PATCH /api/pending-transactions/:id
```

**Confirm:**
```json
{
  "action": "confirm",
  "portfolioId": "...",
  "cashAccountId": "...",
  "overrides": {
    "transactionType": "DIVIDEND",
    "frankingPct": 82
  }
}
```
- `cashAccountId` is optional — if provided and the type is `DIVIDEND`, the total dividend amount is credited to that cash account.
- `overrides` can include `transactionType`, `ticker`, `tradeDate`, `quantity`, `price`, `fees`, `frankingPct`, `notes`.

**Reject:**
```json
{ "action": "reject" }
```

---

## Wealth

### Net worth snapshot
```
GET /api/wealth/net-worth
```
Returns current totals: portfolio value, super, property equity, cash, liabilities.

### Net worth history
```
GET /api/wealth/net-worth-history?months=24
```
Returns a time series of net worth components for charting. Properties stop contributing at their `soldDate`. Mortgage balances are amortized using the loan's interest rate and term.

### Cash accounts

```
GET  /api/wealth/cash
POST /api/wealth/cash
```

```
GET    /api/wealth/cash/:id
PUT    /api/wealth/cash/:id
DELETE /api/wealth/cash/:id
```

**Balance history** (for charting):
```
GET    /api/wealth/cash/:id/balance
POST   /api/wealth/cash/:id/balance
DELETE /api/wealth/cash/:id/balance/:historyId
```

### Properties

```
GET  /api/wealth/properties
POST /api/wealth/properties
```

```
GET    /api/wealth/properties/:id
PUT    /api/wealth/properties/:id
DELETE /api/wealth/properties/:id
```

**Sell a property:**
```
POST /api/wealth/properties/:id/sell
```
```json
{
  "soldDate": "2024-06-30",
  "salePrice": 850000,
  "costBase": 600000,
  "cashAccountId": "...",
  "mortgagePayout": true
}
```
Records the disposal, optionally credits cash proceeds, and clears the mortgage balance. Stores reversal data so the sale can be undone.

**Unsell (reverse a sale):**
```
POST /api/wealth/properties/:id/unsell
```
Reverses all side effects: restores the property's current value, adds back the mortgage balance, and subtracts the credited cash amount.

### Superannuation

```
GET  /api/wealth/super
POST /api/wealth/super
```

```
GET    /api/wealth/super/:id
PUT    /api/wealth/super/:id
DELETE /api/wealth/super/:id
```

---

## Tax

### Tax summary (all portfolios)
```
GET /api/tax/summary?fy=2025
```
Returns CGT events, dividend income, franking credits, and net assessable gain for the financial year.

### Tax-loss harvesting opportunities
```
GET /api/tax/harvest?fy=2025
```
Returns current holdings at an unrealised loss, sorted by loss size. Includes context on how much assessable CGT gain could be offset.

### Backfill franking % on historical dividends
```
POST /api/tax/backfill-franking
```
For all confirmed DIVIDEND/DRP transactions with `frankingPct = 0`, fetches per-payment franking data from MarketIndex and updates the records. Returns `{ updated, total }`.

> Note: MarketIndex is behind Cloudflare and may not respond to server-side requests. Use the button on the `/tax` page when using a browser, or manually edit transactions via the portfolio transaction edit page.

---

## Email Import

### Parse email text
```
POST /api/email/parse
```
```json
{ "text": "raw email body..." }
```
Returns a parsed transaction object for preview before saving.

---

## FIRE Planner

### Get / update FIRE settings
```
GET /api/fire
PUT /api/fire
```
```json
{
  "targetAnnualSpend": 80000,
  "currentAge": 38,
  "retirementAge": 55,
  "expectedReturn": 7,
  "inflationRate": 3,
  "withdrawalRate": 4,
  "superGrowthRate": 8
}
```

### FIRE projection
```
GET /api/fire/projection
```
Returns month-by-month portfolio and super values until the FIRE target is reached, plus the projected FIRE date.

---

## AI Chat

```
POST /api/chat
```
```json
{ "messages": [{ "role": "user", "content": "Am I on track to retire at 55?" }] }
```
Streams a response using your configured AI provider and key. The assistant has read access to your portfolio, net worth, and budget data.

---

## Price Alerts

```
GET  /api/price-alerts
POST /api/price-alerts
```
```json
{ "ticker": "CBA", "targetPrice": 100, "direction": "above" }
```

```
DELETE /api/price-alerts/:id
```

---

## Data types

### Financial year

The Australian financial year runs 1 July – 30 June. `fy=2025` means FY2024–25 (1 Jul 2024 to 30 Jun 2025).

### Dates

All dates are ISO 8601 strings (`YYYY-MM-DD` or full UTC timestamp). Dates stored in the database are UTC midnight.

### Currency

All monetary amounts are in the account/portfolio currency (default `AUD`). Amounts are plain numbers, not strings.

### Franking credits

Franking credits are calculated as:

```
frankingCredit = cashDividend × (frankingPct / 100) × (30 / 70)
grossedUpIncome = cashDividend + frankingCredit
```

This uses the 30% corporate tax rate. The grossed-up amount is what appears on your tax return.

---

## Error responses

All errors return JSON with an `error` field and an appropriate HTTP status code:

```json
{ "error": "portfolioId required to confirm" }
```

Common status codes:
- `400` — missing or invalid parameters
- `401` — not authenticated
- `404` — resource not found or belongs to another user
- `500` — server error (check server logs)
