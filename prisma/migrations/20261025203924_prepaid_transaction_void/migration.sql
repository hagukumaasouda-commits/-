-- AlterTable
ALTER TABLE "PrepaidTransaction" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedByStaffId" TEXT;

-- AddForeignKey
ALTER TABLE "PrepaidTransaction" ADD CONSTRAINT "PrepaidTransaction_voidedByStaffId_fkey" FOREIGN KEY ("voidedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

