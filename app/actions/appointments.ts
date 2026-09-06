"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@/app/generated/prisma/client";

/** 次回予約日を入力・更新する(docs/next-appointment-cancellation-spec-v2.md)。 */
export async function setNextAppointment(clientId: string, formData: FormData) {
  const dateRaw = String(formData.get("nextAppointmentDate") || "");
  if (!dateRaw) throw new Error("次回予約日を入力してください");

  await prisma.client.update({
    where: { id: clientId },
    data: {
      nextAppointmentDate: new Date(dateRaw),
      appointmentStatus: AppointmentStatus.BOOKED,
    },
  });

  revalidatePath(`/clients/${clientId}`);
}

/** 次回予約をキャンセルする。cancelledAtは離脱フォロー2.5節のキャンセル起点日として使われる。 */
export async function cancelNextAppointment(clientId: string) {
  await prisma.client.update({
    where: { id: clientId },
    data: {
      appointmentStatus: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      nextAppointmentDate: null,
    },
  });

  revalidatePath(`/clients/${clientId}`);
}
