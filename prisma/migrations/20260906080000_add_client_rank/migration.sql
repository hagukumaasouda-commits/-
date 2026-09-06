-- CreateEnum
CREATE TYPE "ClientRank" AS ENUM ('AS', 'A', 'B', 'C1', 'C2', 'C3');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "rank" "ClientRank";
