-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('RIPPLE', 'GRANT', 'OTHER');

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "category",
ADD COLUMN     "category" "ProductCategory" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "ProductStockIn" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockInDate" TIMESTAMP(3) NOT NULL,
    "staffId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductStockIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductStockIn_productId_stockInDate_idx" ON "ProductStockIn"("productId", "stockInDate");

-- AddForeignKey
ALTER TABLE "ProductStockIn" ADD CONSTRAINT "ProductStockIn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStockIn" ADD CONSTRAINT "ProductStockIn_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
