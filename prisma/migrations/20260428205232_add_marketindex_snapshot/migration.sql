-- CreateTable
CREATE TABLE "MarketIndexSnapshot" (
    "ticker" TEXT NOT NULL PRIMARY KEY,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" REAL,
    "change" REAL,
    "changePct" REAL,
    "volume" TEXT,
    "marketCap" TEXT,
    "peRatio" REAL,
    "eps" REAL,
    "dividendYield" REAL,
    "dividendAmount" REAL,
    "frankingPct" INTEGER,
    "high52Week" REAL,
    "low52Week" REAL,
    "sector" TEXT,
    "industry" TEXT,
    "companyName" TEXT,
    "extras" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MarketIndexSnapshot_fetchedAt_idx" ON "MarketIndexSnapshot"("fetchedAt");
