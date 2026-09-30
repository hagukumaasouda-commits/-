"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ClientPhotoCategory } from "@/app/generated/prisma/client";
import { uploadClientPhoto as uploadToStorage, deleteClientPhoto as deleteFromStorage } from "@/lib/supabase-storage";

export async function addClientPhoto(clientId: string, formData: FormData) {
  const session = await auth();
  const staffId = session?.user?.id;
  if (!staffId) throw new Error("ログインが必要です");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("画像ファイルを選択してください");

  const categoryRaw = String(formData.get("category") || "");
  const category = categoryRaw as ClientPhotoCategory;
  if (!Object.values(ClientPhotoCategory).includes(category)) throw new Error("区分を選択してください");

  const takenAtRaw = String(formData.get("takenAt") || "");
  const takenAt = takenAtRaw ? new Date(takenAtRaw) : new Date();
  const note = String(formData.get("note") || "") || null;

  const storagePath = await uploadToStorage(clientId, file);

  await prisma.clientPhoto.create({
    data: { clientId, category, storagePath, takenAt, note, uploadedById: staffId },
  });

  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClientPhoto(photoId: string) {
  const session = await auth();
  const staffId = session?.user?.id;
  if (!staffId) throw new Error("ログインが必要です");

  const photo = await prisma.clientPhoto.findUniqueOrThrow({ where: { id: photoId } });

  await deleteFromStorage(photo.storagePath);
  await prisma.clientPhoto.delete({ where: { id: photoId } });

  revalidatePath(`/clients/${photo.clientId}`);
}
