-- CreateEnum
CREATE TYPE "ProductItemType" AS ENUM ('FULL', 'LOOSE');

-- CreateEnum
CREATE TYPE "ProductPurchaseType" AS ENUM ('NEW', 'REPEAT');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSale" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "clientId" TEXT,
    "rawClientLabel" TEXT,
    "staffId" TEXT,
    "rawStaffName" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "itemType" "ProductItemType" NOT NULL,
    "purchaseType" "ProductPurchaseType" NOT NULL,
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "visitCountAtSale" INTEGER,
    "dedupKey" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSale_dedupKey_key" ON "ProductSale"("dedupKey");

-- CreateIndex
CREATE INDEX "ProductSale_saleDate_idx" ON "ProductSale"("saleDate");

-- CreateIndex
CREATE INDEX "ProductSale_productId_saleDate_idx" ON "ProductSale"("productId", "saleDate");

-- CreateIndex
CREATE INDEX "ProductSale_clientId_idx" ON "ProductSale"("clientId");

-- CreateIndex
CREATE INDEX "ProductSale_staffId_idx" ON "ProductSale"("staffId");

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

