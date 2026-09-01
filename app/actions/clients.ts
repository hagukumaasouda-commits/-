"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function createClient(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("氏名は必須です");

  const acquisitionChannelId = String(formData.get("acquisitionChannelId") || "") || null;
  const referredById = String(formData.get("referredById") || "") || null;
  const primaryStaffId = String(formData.get("primaryStaffId") || "") || null;
  const firstVisitDateRaw = String(formData.get("firstVisitDate") || "");

  const client = await prisma.client.create({
    data: {
      name,
      kana: String(formData.get("kana") || "") || null,
      gender: String(formData.get("gender") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      acquisitionChannelId,
      referredById,
      primaryStaffId,
      firstVisitDate: firstVisitDateRaw ? new Date(firstVisitDateRaw) : null,
    },
  });

  if (primaryStaffId) {
    await prisma.clientStaff.create({ data: { clientId: client.id, staffId: primaryStaffId } });
  }

  redirect(`/clients/${client.id}`);
}
