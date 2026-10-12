-- CreateTable
CREATE TABLE "IntakeResponse" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "kana" TEXT,
    "phone" TEXT,
    "answers" JSONB NOT NULL,
    "linkedClientId" TEXT,
    "linkedAt" TIMESTAMP(3),
    "linkedByStaffId" TEXT,

    CONSTRAINT "IntakeResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntakeResponse_linkedClientId_key" ON "IntakeResponse"("linkedClientId");

-- CreateIndex
CREATE INDEX "IntakeResponse_lineUserId_idx" ON "IntakeResponse"("lineUserId");

-- CreateIndex
CREATE INDEX "IntakeResponse_linkedClientId_idx" ON "IntakeResponse"("linkedClientId");

-- AddForeignKey
ALTER TABLE "IntakeResponse" ADD CONSTRAINT "IntakeResponse_linkedClientId_fkey" FOREIGN KEY ("linkedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeResponse" ADD CONSTRAINT "IntakeResponse_linkedByStaffId_fkey" FOREIGN KEY ("linkedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

