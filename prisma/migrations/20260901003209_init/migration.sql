-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('STAFF', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "PrepaidTxType" AS ENUM ('CHARGE', 'USE', 'ADJUST');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('HOTPEPPER', 'LINE', 'PHONE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'CHANGED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CheckType" AS ENUM ('OFFICE', 'AI_INSIGHT');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'NOTICE', 'IMPORTANT');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('OPEN', 'DISCUSSED', 'RESOLVED');

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcquisitionChannel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AcquisitionChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kana" TEXT,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "occupation" TEXT,
    "lifestyleTags" JSONB,
    "acquisitionChannelId" TEXT,
    "referredById" TEXT,
    "primaryStaffId" TEXT,
    "firstVisitDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientStaff" (
    "clientId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,

    CONSTRAINT "ClientStaff_pkey" PRIMARY KEY ("clientId","staffId")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "courseId" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "visitNo" INTEGER NOT NULL,
    "menu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartRecord" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "chiefComplaintTags" TEXT[],
    "bodyPartTags" TEXT[],
    "exam" JSONB,
    "treatmentDetail" JSONB,
    "evaluation" TEXT,
    "changeFromLast" TEXT,
    "reevaluation" TEXT,
    "meaningConveyed" TEXT,
    "clientVoice" TEXT,
    "nextCheck" TEXT,
    "nextRequired" TEXT,
    "requiredFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentCourse" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "courseNo" INTEGER NOT NULL,
    "planType" TEXT NOT NULL,
    "plannedSessions" INTEGER,
    "durationProposal" JSONB,
    "goal" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),

    CONSTRAINT "TreatmentCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepaidCard" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "planType" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "PrepaidCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepaidTransaction" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "txType" "PrepaidTxType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER,
    "txDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitId" TEXT,
    "note" TEXT,

    CONSTRAINT "PrepaidTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "source" "ReservationSource" NOT NULL DEFAULT 'MANUAL',
    "reservedAt" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "reminderSentAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwarenessCheck" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "checkType" "CheckType" NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'INFO',
    "status" "CheckStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwarenessCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwarenessDialogue" (
    "id" TEXT NOT NULL,
    "awarenessCheckId" TEXT NOT NULL,
    "authorStaffId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwarenessDialogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMindsetCheck" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "selfCheck" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMindsetCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientStatusSnapshot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "rank" TEXT,
    "healthScore" INTEGER,
    "statusLabel" TEXT,

    CONSTRAINT "ClientStatusSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcquisitionChannel_name_key" ON "AcquisitionChannel"("name");

-- CreateIndex
CREATE INDEX "Client_acquisitionChannelId_idx" ON "Client"("acquisitionChannelId");

-- CreateIndex
CREATE INDEX "Client_primaryStaffId_idx" ON "Client"("primaryStaffId");

-- CreateIndex
CREATE INDEX "Client_firstVisitDate_idx" ON "Client"("firstVisitDate");

-- CreateIndex
CREATE INDEX "Visit_clientId_visitDate_idx" ON "Visit"("clientId", "visitDate");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_clientId_visitNo_key" ON "Visit"("clientId", "visitNo");

-- CreateIndex
CREATE UNIQUE INDEX "ChartRecord_visitId_key" ON "ChartRecord"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "PrepaidCard_clientId_key" ON "PrepaidCard"("clientId");

-- CreateIndex
CREATE INDEX "PrepaidTransaction_cardId_txDate_idx" ON "PrepaidTransaction"("cardId", "txDate");

-- CreateIndex
CREATE INDEX "Reservation_clientId_reservedAt_idx" ON "Reservation"("clientId", "reservedAt");

-- CreateIndex
CREATE INDEX "AwarenessCheck_visitId_idx" ON "AwarenessCheck"("visitId");

-- CreateIndex
CREATE INDEX "AwarenessCheck_status_idx" ON "AwarenessCheck"("status");

-- CreateIndex
CREATE INDEX "ClientStatusSnapshot_clientId_snapshotDate_idx" ON "ClientStatusSnapshot"("clientId", "snapshotDate");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_acquisitionChannelId_fkey" FOREIGN KEY ("acquisitionChannelId") REFERENCES "AcquisitionChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_primaryStaffId_fkey" FOREIGN KEY ("primaryStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStaff" ADD CONSTRAINT "ClientStaff_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStaff" ADD CONSTRAINT "ClientStaff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TreatmentCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartRecord" ADD CONSTRAINT "ChartRecord_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentCourse" ADD CONSTRAINT "TreatmentCourse_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepaidCard" ADD CONSTRAINT "PrepaidCard_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepaidTransaction" ADD CONSTRAINT "PrepaidTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "PrepaidCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepaidTransaction" ADD CONSTRAINT "PrepaidTransaction_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwarenessCheck" ADD CONSTRAINT "AwarenessCheck_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwarenessDialogue" ADD CONSTRAINT "AwarenessDialogue_awarenessCheckId_fkey" FOREIGN KEY ("awarenessCheckId") REFERENCES "AwarenessCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwarenessDialogue" ADD CONSTRAINT "AwarenessDialogue_authorStaffId_fkey" FOREIGN KEY ("authorStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMindsetCheck" ADD CONSTRAINT "StaffMindsetCheck_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMindsetCheck" ADD CONSTRAINT "StaffMindsetCheck_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStatusSnapshot" ADD CONSTRAINT "ClientStatusSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
