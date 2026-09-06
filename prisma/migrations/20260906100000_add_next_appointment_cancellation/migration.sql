-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CANCELLED', 'NONE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "appointmentStatus" "AppointmentStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "nextAppointmentDate" TIMESTAMP(3);
