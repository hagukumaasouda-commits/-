"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendLineTextMessage, buildReservationReminderMessage } from "@/lib/line";

export type ReminderActionState = { reservationId: string; result: Awaited<ReturnType<typeof sendReservationReminder>> } | undefined;

export async function submitReminder(_prevState: ReminderActionState, formData: FormData): Promise<ReminderActionState> {
  const reservationId = String(formData.get("reservationId") || "");
  if (!reservationId) return undefined;
  const result = await sendReservationReminder(reservationId);
  return { reservationId, result };
}

export async function sendReservationReminder(reservationId: string) {
  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: { client: { select: { name: true, lineUserId: true } } },
  });

  const message = buildReservationReminderMessage(reservation.client.name, reservation.reservedAt);
  const result = await sendLineTextMessage(reservation.client.lineUserId, message);

  if (result.ok) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { reminderSentAt: new Date() },
    });
  }

  revalidatePath("/reminders");
  return result;
}
