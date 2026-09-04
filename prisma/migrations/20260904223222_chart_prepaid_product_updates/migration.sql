-- AlterTable
ALTER TABLE "ChartRecord" ADD COLUMN     "healthPracticeNote" TEXT,
ADD COLUMN     "lifestyleSupportStatus" JSONB;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "familyData" TEXT,
ADD COLUMN     "medicalHistory" TEXT;

-- AlterTable
ALTER TABLE "PrepaidTransaction" ADD COLUMN     "staffId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultPrice" INTEGER;

-- AlterTable
ALTER TABLE "ProductSale" ADD COLUMN     "quantity" INTEGER;

-- AddForeignKey
ALTER TABLE "PrepaidTransaction" ADD CONSTRAINT "PrepaidTransaction_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
