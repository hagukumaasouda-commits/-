-- CreateEnum
CREATE TYPE "ProductStockMovementType" AS ENUM ('PURCHASE', 'TRANSFER_OUT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "ProductStockIn" ADD COLUMN     "destination" TEXT,
ADD COLUMN     "type" "ProductStockMovementType" NOT NULL DEFAULT 'PURCHASE';
