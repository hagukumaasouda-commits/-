-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "externalCustomerNo" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "sourceStaffName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Client_externalCustomerNo_key" ON "Client"("externalCustomerNo");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_externalId_key" ON "Reservation"("externalId");

