/*
  Warnings:

  - Added the required column `userId` to the `Portfolio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `PriceAlert` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingTransaction" (
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
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingTransaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PendingTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PendingTransaction" ("confirmedAt", "createdAt", "currency", "fees", "fromAddress", "id", "parseConfidence", "parseWarnings", "portfolioId", "price", "quantity", "rawContent", "receivedAt", "rejectedAt", "source", "status", "ticker", "tradeDate", "transactionId", "transactionType", "updatedAt") SELECT "confirmedAt", "createdAt", "currency", "fees", "fromAddress", "id", "parseConfidence", "parseWarnings", "portfolioId", "price", "quantity", "rawContent", "receivedAt", "rejectedAt", "source", "status", "ticker", "tradeDate", "transactionId", "transactionType", "updatedAt" FROM "PendingTransaction";
DROP TABLE "PendingTransaction";
ALTER TABLE "new_PendingTransaction" RENAME TO "PendingTransaction";
CREATE UNIQUE INDEX "PendingTransaction_transactionId_key" ON "PendingTransaction"("transactionId");
CREATE TABLE "new_Portfolio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Portfolio" ("createdAt", "currency", "description", "id", "name", "updatedAt") SELECT "createdAt", "currency", "description", "id", "name", "updatedAt" FROM "Portfolio";
DROP TABLE "Portfolio";
ALTER TABLE "new_Portfolio" RENAME TO "Portfolio";
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");
CREATE TABLE "new_PriceAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "targetPrice" REAL NOT NULL,
    "direction" TEXT NOT NULL,
    "note" TEXT,
    "isTriggered" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" DATETIME,
    "triggeredPrice" REAL,
    "portfolioId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PriceAlert_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PriceAlert" ("createdAt", "direction", "id", "isTriggered", "note", "portfolioId", "targetPrice", "ticker", "triggeredAt", "triggeredPrice", "updatedAt") SELECT "createdAt", "direction", "id", "isTriggered", "note", "portfolioId", "targetPrice", "ticker", "triggeredAt", "triggeredPrice", "updatedAt" FROM "PriceAlert";
DROP TABLE "PriceAlert";
ALTER TABLE "new_PriceAlert" RENAME TO "PriceAlert";
CREATE INDEX "PriceAlert_userId_idx" ON "PriceAlert"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
