-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "portfolioId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "price" DECIMAL NOT NULL,
    "fees" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "fromAddress" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionType" TEXT,
    "ticker" TEXT,
    "quantity" REAL,
    "price" REAL,
    "fees" REAL,
    "currency" TEXT DEFAULT 'AUD',
    "tradeDate" DATETIME,
    "parseConfidence" REAL,
    "parseWarnings" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" DATETIME,
    "rejectedAt" DATETIME,
    "transactionId" TEXT,
    "portfolioId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingTransaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceCache" (
    "ticker" TEXT NOT NULL PRIMARY KEY,
    "price" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "change" DECIMAL,
    "changePct" DECIMAL,
    "marketTime" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'ASX'
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "targetPrice" REAL NOT NULL,
    "direction" TEXT NOT NULL,
    "note" TEXT,
    "isTriggered" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" DATETIME,
    "triggeredPrice" REAL,
    "portfolioId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PriceAlert_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "asxId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "marketSensitive" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" DATETIME NOT NULL,
    "category" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HistoricalPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "open" REAL,
    "high" REAL,
    "low" REAL,
    "close" REAL NOT NULL,
    "volume" BIGINT,
    "source" TEXT NOT NULL DEFAULT 'ASX'
);

-- CreateIndex
CREATE INDEX "Transaction_portfolioId_idx" ON "Transaction"("portfolioId");

-- CreateIndex
CREATE INDEX "Transaction_ticker_idx" ON "Transaction"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "PendingTransaction_transactionId_key" ON "PendingTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "PriceCache_fetchedAt_idx" ON "PriceCache"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_asxId_key" ON "Announcement"("asxId");

-- CreateIndex
CREATE INDEX "Announcement_ticker_idx" ON "Announcement"("ticker");

-- CreateIndex
CREATE INDEX "HistoricalPrice_ticker_idx" ON "HistoricalPrice"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalPrice_ticker_date_source_key" ON "HistoricalPrice"("ticker", "date", "source");
