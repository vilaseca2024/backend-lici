-- AlterTable
ALTER TABLE "internal" ADD COLUMN     "hasDispatchTypeFilters" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasExcelExport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasPdfExport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasRegimenFilters" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasStatusFilters" BOOLEAN NOT NULL DEFAULT false;
