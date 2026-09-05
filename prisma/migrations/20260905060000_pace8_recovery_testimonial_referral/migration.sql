-- CreateEnum
CREATE TYPE "HealthHappinessScore" AS ENUM ('ABOVE_80', 'PCT_70', 'PCT_60', 'PCT_55', 'PCT_50', 'PCT_40', 'BELOW_40');

-- AlterEnum
-- VisitInterval is replaced with the 8-option set matching the real client
-- sheet (docs/departure-followup-spec-v2.md v3). Existing values are
-- remapped rather than cast 1:1, since none of the new labels reuse the old
-- names. Old MONTHLY (30 days) has no exact match in the new set and is
-- mapped to the nearest option, WEEK4 (28 days).
BEGIN;
CREATE TYPE "VisitInterval_new" AS ENUM ('TWICE_OR_THRICE_WEEKLY', 'WEEK1', 'DAY10', 'WEEK2', 'WEEK3', 'WEEK4', 'MONTH2', 'MONTH3');
ALTER TABLE "ChartRecord" ALTER COLUMN "requiredVisitInterval" TYPE "VisitInterval_new" USING (
  CASE "requiredVisitInterval"::text
    WHEN 'WEEKLY' THEN 'WEEK1'
    WHEN 'BIWEEKLY' THEN 'WEEK2'
    WHEN 'TRIWEEKLY' THEN 'WEEK3'
    WHEN 'MONTHLY' THEN 'WEEK4'
    WHEN 'MAINTENANCE' THEN 'MONTH2'
    ELSE NULL
  END
)::"VisitInterval_new";
ALTER TYPE "VisitInterval" RENAME TO "VisitInterval_old";
ALTER TYPE "VisitInterval_new" RENAME TO "VisitInterval";
DROP TYPE "public"."VisitInterval_old";
COMMIT;

-- AlterTable
ALTER TABLE "ChartRecord" ADD COLUMN     "healthHappinessScore" "HealthHappinessScore",
ADD COLUMN     "referralCount" INTEGER,
ADD COLUMN     "referralGiven" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testimonialObtained" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testimonialObtainedDate" TIMESTAMP(3);
