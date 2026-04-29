-- CreateTable
CREATE TABLE "TickerClassification" (
    "ticker" TEXT NOT NULL PRIMARY KEY,
    "instrumentType" TEXT,
    "riskCategory" TEXT,
    "assetClasses" TEXT,
    "industries" TEXT,
    "regions" TEXT,
    "customGroups" TEXT,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL
);
