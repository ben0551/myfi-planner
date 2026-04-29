-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "type" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    "purchasePrice" REAL NOT NULL,
    "purchaseDate" DATETIME NOT NULL,
    "currentValue" REAL NOT NULL,
    "ownershipPct" REAL NOT NULL DEFAULT 100,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Property_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PropertyValueHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "value" REAL NOT NULL,
    CONSTRAINT "PropertyValueHistory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mortgage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "originalAmount" REAL NOT NULL,
    "currentBalance" REAL NOT NULL,
    "interestRate" REAL NOT NULL,
    "loanType" TEXT NOT NULL DEFAULT 'PI',
    "repaymentAmount" REAL NOT NULL,
    "repaymentFreq" TEXT NOT NULL DEFAULT 'MONTHLY',
    "startDate" DATETIME NOT NULL,
    "termYears" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mortgage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuperAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fundName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "currentBalance" REAL NOT NULL,
    "employerContribPct" REAL NOT NULL DEFAULT 11.5,
    "employeeContribPct" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "notes" TEXT,
    "balanceUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SuperAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuperBalanceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "balance" REAL NOT NULL,
    CONSTRAINT "SuperBalanceHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SuperAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "balance" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CashAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FireSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "annualExpenses" REAL NOT NULL,
    "withdrawalRate" REAL NOT NULL DEFAULT 4.0,
    "expectedReturn" REAL NOT NULL DEFAULT 7.0,
    "inflationRate" REAL NOT NULL DEFAULT 3.0,
    "monthlySavings" REAL NOT NULL DEFAULT 0,
    "currentAge" INTEGER NOT NULL,
    "targetRetireAge" INTEGER,
    "includeSuper" BOOLEAN NOT NULL DEFAULT true,
    "includePropertyEquity" BOOLEAN NOT NULL DEFAULT true,
    "includeCash" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FireSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Property_userId_idx" ON "Property"("userId");

-- CreateIndex
CREATE INDEX "PropertyValueHistory_propertyId_idx" ON "PropertyValueHistory"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyValueHistory_propertyId_date_key" ON "PropertyValueHistory"("propertyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Mortgage_propertyId_key" ON "Mortgage"("propertyId");

-- CreateIndex
CREATE INDEX "SuperAccount_userId_idx" ON "SuperAccount"("userId");

-- CreateIndex
CREATE INDEX "SuperBalanceHistory_accountId_idx" ON "SuperBalanceHistory"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "SuperBalanceHistory_accountId_date_key" ON "SuperBalanceHistory"("accountId", "date");

-- CreateIndex
CREATE INDEX "CashAccount_userId_idx" ON "CashAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FireSettings_userId_key" ON "FireSettings"("userId");
