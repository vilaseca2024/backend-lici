-- CreateTable
CREATE TABLE "internal" (
    "id" SERIAL NOT NULL,
    "internalCode" TEXT NOT NULL,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "userId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "updatedBy" INTEGER,
    "availableFields" TEXT,
    "hasManagementFilters" BOOLEAN NOT NULL DEFAULT false,
    "hasSearchFilters" BOOLEAN NOT NULL DEFAULT false,
    "hasSearchFiltersAll" BOOLEAN NOT NULL DEFAULT false,
    "hasChannelFilters" BOOLEAN NOT NULL DEFAULT false,
    "hasDateFilters" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "internal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_internalCode_key" ON "internal"("internalCode");

-- CreateIndex
CREATE INDEX "internal_userId_idx" ON "internal"("userId");

-- CreateIndex
CREATE INDEX "internal_status_idx" ON "internal"("status");

-- CreateIndex
CREATE INDEX "internal_internalCode_idx" ON "internal"("internalCode");

-- AddForeignKey
ALTER TABLE "internal" ADD CONSTRAINT "internal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
