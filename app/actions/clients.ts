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

export async function updateClient(clientId: string, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("氏名は必須です");

  const dobRaw = String(formData.get("dob") || "");
  const firstVisitDateRaw = String(formData.get("firstVisitDate") || "");
  const acquisitionChannelId = String(formData.get("acquisitionChannelId") || "") || null;
  const referredById = String(formData.get("referredById") || "") || null;
  const primaryStaffId = String(formData.get("primaryStaffId") || "") || null;

  await prisma.client.update({
    where: { id: clientId },
    data: {
      name,
      kana: String(formData.get("kana") || "") || null,
      dob: dobRaw ? new Date(dobRaw) : null,
      gender: String(formData.get("gender") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      postalCode: String(formData.get("postalCode") || "") || null,
      address: String(formData.get("address") || "") || null,
      occupation: String(formData.get("occupation") || "") || null,
      acquisitionChannelId,
      referredById: referredById === clientId ? null : referredById, // 自分自身を紹介元にはできない
      primaryStaffId,
      firstVisitDate: firstVisitDateRaw ? new Date(firstVisitDateRaw) : null,
      medicalHistory: String(formData.get("medicalHistory") || "") || null,
      familyData: String(formData.get("familyData") || "") || null,
    },
  });

  if (primaryStaffId) {
    await prisma.clientStaff.upsert({
      where: { clientId_staffId: { clientId, staffId: primaryStaffId } },
      update: {},
      create: { clientId, staffId: primaryStaffId },
    });
  }

  redirect(`/clients/${clientId}`);
}
