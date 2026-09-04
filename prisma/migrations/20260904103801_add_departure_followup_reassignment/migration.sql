-- CreateEnum
CREATE TYPE "VisitInterval" AS ENUM ('WEEKLY', 'BIWEEKLY', 'TRIWEEKLY', 'MONTHLY', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "DepartureReason" AS ENUM ('GRADUATED', 'TRIAL_ONLY', 'TEMPORARY_VISITOR', 'SWITCHED_BRANCH', 'NO_PERCEIVED_EFFECT', 'LIFE_CHANGE', 'STAFF_MINDSET_LACK', 'OTHER');

-- CreateEnum
CREATE TYPE "CheckpointStage" AS ENUM ('WEEK3', 'WEEK6', 'MONTH3', 'MONTH6', 'YEAR1');

-- CreateEnum
CREATE TYPE "FollowupStatus" AS ENUM ('PENDING', 'CONTACTED');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('LINE', 'PHONE', 'LETTER', 'IN_PERSON', 'OTHER');

-- CreateEnum
CREATE TYPE "FollowupResponse" AS ENUM ('WILLING_TO_CONTINUE', 'NOT_CONTINUING', 'NO_RESPONSE', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "ReassignmentInitiator" AS ENUM ('STAFF_SELF', 'DIRECTOR', 'AWARENESS_CHECK');

-- CreateEnum
CREATE TYPE "ReassignmentStatus" AS ENUM ('IN_DISCUSSION', 'CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "ChartRecord" ADD COLUMN     "requiredVisitInterval" "VisitInterval";

-- CreateTable
CREATE TABLE "DepartureRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" "DepartureReason",
    "reasonNote" TEXT,
    "triggeredByCancellation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DepartureRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowupCheckpoint" (
    "id" TEXT NOT NULL,
    "departureRecordId" TEXT NOT NULL,
    "stage" "CheckpointStage" NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" "FollowupStatus" NOT NULL DEFAULT 'PENDING',
    "contactMethod" "ContactMethod",
    "response" "FollowupResponse",
    "contactedById" TEXT,
    "contactedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "FollowupCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReassignmentRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "currentStaffId" TEXT NOT NULL,
    "initiatedBy" "ReassignmentInitiator" NOT NULL,
    "requestedByStaffId" TEXT,
    "note" TEXT,
    "status" "ReassignmentStatus" NOT NULL DEFAULT 'IN_DISCUSSION',
    "newStaffId" TEXT,
    "handoverNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReassignmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepartureRecord_clientId_idx" ON "DepartureRecord"("clientId");

-- CreateIndex
CREATE INDEX "FollowupCheckpoint_departureRecordId_idx" ON "FollowupCheckpoint"("departureRecordId");

-- CreateIndex
CREATE INDEX "FollowupCheckpoint_scheduledDate_idx" ON "FollowupCheckpoint"("scheduledDate");

-- CreateIndex
CREATE INDEX "ReassignmentRequest_clientId_idx" ON "ReassignmentRequest"("clientId");

-- CreateIndex
CREATE INDEX "ReassignmentRequest_status_idx" ON "ReassignmentRequest"("status");

-- AddForeignKey
ALTER TABLE "DepartureRecord" ADD CONSTRAINT "DepartureRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartureRecord" ADD CONSTRAINT "DepartureRecord_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowupCheckpoint" ADD CONSTRAINT "FollowupCheckpoint_departureRecordId_fkey" FOREIGN KEY ("departureRecordId") REFERENCES "DepartureRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowupCheckpoint" ADD CONSTRAINT "FollowupCheckpoint_contactedById_fkey" FOREIGN KEY ("contactedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentRequest" ADD CONSTRAINT "ReassignmentRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentRequest" ADD CONSTRAINT "ReassignmentRequest_currentStaffId_fkey" FOREIGN KEY ("currentStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentRequest" ADD CONSTRAINT "ReassignmentRequest_requestedByStaffId_fkey" FOREIGN KEY ("requestedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentRequest" ADD CONSTRAINT "ReassignmentRequest_newStaffId_fkey" FOREIGN KEY ("newStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
