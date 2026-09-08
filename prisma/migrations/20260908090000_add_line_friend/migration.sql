-- CreateTable
CREATE TABLE "LineFriend" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unfollowedAt" TIMESTAMP(3),
    "linkedClientId" TEXT,
    "linkedAt" TIMESTAMP(3),
    "linkedByStaffId" TEXT,

    CONSTRAINT "LineFriend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LineFriend_lineUserId_key" ON "LineFriend"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LineFriend_linkedClientId_key" ON "LineFriend"("linkedClientId");

-- CreateIndex
CREATE INDEX "LineFriend_linkedClientId_idx" ON "LineFriend"("linkedClientId");

-- AddForeignKey
ALTER TABLE "LineFriend" ADD CONSTRAINT "LineFriend_linkedClientId_fkey" FOREIGN KEY ("linkedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineFriend" ADD CONSTRAINT "LineFriend_linkedByStaffId_fkey" FOREIGN KEY ("linkedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
