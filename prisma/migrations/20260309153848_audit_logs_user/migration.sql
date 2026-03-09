/*
  Warnings:

  - Added the required column `updatedAt` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `permissions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `roles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `user_roles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;
