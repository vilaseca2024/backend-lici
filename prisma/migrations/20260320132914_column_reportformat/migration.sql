/*
  Warnings:

  - You are about to drop the column `internalCode` on the `internal` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "internal_internalCode_idx";

-- DropIndex
DROP INDEX "internal_internalCode_key";

-- AlterTable
ALTER TABLE "internal" DROP COLUMN "internalCode",
ADD COLUMN     "ageiCode" TEXT[],
ADD COLUMN     "contabilidadCode" TEXT[],
ADD COLUMN     "trazabilidadCode" TEXT[];
