-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "portfolioId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "price" DECIMAL NOT NULL,
    "fees" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL,
    "frankingPct" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "createdAt", "date", "fees", "id", "notes", "portfolioId", "price", "quantity", "ticker", "type", "updatedAt") SELECT "amount", "createdAt", "date", "fees", "id", "notes", "portfolioId", "price", "quantity", "ticker", "type", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_portfolioId_idx" ON "Transaction"("portfolioId");
CREATE INDEX "Transaction_ticker_idx" ON "Transaction"("ticker");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
