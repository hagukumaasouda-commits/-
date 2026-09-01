-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "lineUserId" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Client_lineUserId_key" ON "Client"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_username_key" ON "Staff"("username");

