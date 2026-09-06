-- CreateEnum
CREATE TYPE "ReferralSourceType" AS ENUM ('EXISTING_CLIENT', 'STAFF', 'OTHER');

-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('NEW', 'EXISTING');

-- AlterTable: ChartRecord (additive, safe)
ALTER TABLE "ChartRecord" ADD COLUMN "isManualReturnFlag" BOOLEAN NOT NULL DEFAULT false;

-- Rename referredById -> referralSourceClientId, preserving existing data and the FK.
ALTER TABLE "Client" RENAME COLUMN "referredById" TO "referralSourceClientId";
ALTER TABLE "Client" RENAME CONSTRAINT "Client_referredById_fkey" TO "Client_referralSourceClientId_fkey";

-- AlterTable: Client new columns (registrationType added nullable first, backfilled below, then required)
ALTER TABLE "Client"
  ADD COLUMN "referralSourceType" "ReferralSourceType",
  ADD COLUMN "referralSourceStaffId" TEXT,
  ADD COLUMN "referralSourceNote" TEXT,
  ADD COLUMN "referralCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "registrationType" "RegistrationType";

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_referralSourceStaffId_fkey" FOREIGN KEY ("referralSourceStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: any client that already had a referral-source client set was necessarily an "existing patient" referral
-- under the old referredById-only mechanism (docs/referral-source-registration-type-spec-v2.md).
UPDATE "Client" SET "referralSourceType" = 'EXISTING_CLIENT' WHERE "referralSourceClientId" IS NOT NULL;

-- Backfill referralCount from historical per-visit referral records (ChartRecord.referralGiven),
-- so the new cumulative counter isn't reset to 0 for clients with real recorded referrals.
UPDATE "Client" c
SET "referralCount" = c."referralCount" + sub.total
FROM (
  SELECT v."clientId" AS client_id, SUM(COALESCE(cr."referralCount", 1)) AS total
  FROM "ChartRecord" cr
  JOIN "Visit" v ON v.id = cr."visitId"
  WHERE cr."referralGiven" = true
  GROUP BY v."clientId"
) sub
WHERE c.id = sub.client_id;

-- Backfill referralCount from historical referredById links (each such link represents one referred new client).
UPDATE "Client" c
SET "referralCount" = c."referralCount" + sub.cnt
FROM (
  SELECT "referralSourceClientId" AS client_id, COUNT(*) AS cnt
  FROM "Client"
  WHERE "referralSourceClientId" IS NOT NULL
  GROUP BY "referralSourceClientId"
) sub
WHERE c.id = sub.client_id;

-- Backfill registrationType: no reliable historical signal distinguishes "registered as new" from
-- "registered as an existing-patient migration" before this feature existed, so approximate using
-- initialVisitCount (docs/client-list-timeline-menu-spec-v2.md 2節): a nonzero prior visit count implies
-- the client was an existing patient at registration time; zero implies a true new patient.
UPDATE "Client" SET "registrationType" = CASE WHEN "initialVisitCount" > 0 THEN 'EXISTING' ELSE 'NEW' END::"RegistrationType"
WHERE "registrationType" IS NULL;

-- Now that every row has a value, enforce NOT NULL going forward.
ALTER TABLE "Client" ALTER COLUMN "registrationType" SET NOT NULL;
