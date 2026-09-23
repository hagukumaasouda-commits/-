-- AlterTable
ALTER TABLE "ChartRecord" DROP COLUMN "exam",
ADD COLUMN     "sittingExam" JSONB,
ADD COLUMN     "standingExam" JSONB,
ADD COLUMN     "supineExam" JSONB;
