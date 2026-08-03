-- AlterTable
ALTER TABLE "ActivitySession" ADD COLUMN     "phase" TEXT NOT NULL DEFAULT 'REGULAR';

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "isRetry" BOOLEAN NOT NULL DEFAULT false;
