-- CreateEnum
CREATE TYPE "MenuPlan" AS ENUM ('BASIC_CARE', 'REPAIRNESS_PLAN', 'CONDITIONING_PLAN', 'WELLNESS_PLAN');

-- AlterTable
ALTER TABLE "ChartRecord" ADD COLUMN     "menuPlan" "MenuPlan",
ADD COLUMN     "treatmentModalities" JSONB;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "initialVisitCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "personalData" TEXT;
