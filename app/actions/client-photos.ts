"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ClientPhotoCategory } from "@/app/generated/prisma/client";
import { createClientPhotoUploadTicket, deleteClientPhoto as deleteFromStorage } from "@/lib/supabase-storage";

/**
 * 画像本体を送る前に、Supabase Storageへブラウザから直接アップロードするための
 * 署名付きアップロードURL(token)を発行する。service_role鍵が必要なためサーバー側でのみ発行できる。
 * (docs/client-photos-upload-fix-v2.md: Vercelのサーバー関数のボディサイズ上限を回避するため)
 */
export async function requestClientPhotoUpload(clientId: string, fileName: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("ログインが必要です");

  return createClientPhotoUploadTicket(clientId, fileName);
}

/** ブラウザから直接Supabase Storageへのアップロードが完了した後に、DBレコードを作成する。 */
export async function finalizeClientPhoto(clientId: string, formData: FormData) {
  const session = await auth();
  const staffId = session?.user?.id;
  if (!staffId) throw new Error("ログインが必要です");

  const storagePath = String(formData.get("storagePath") || "");
  if (!storagePath) throw new Error("画像のアップロードに失敗しました");

  const categoryRaw = String(formData.get("category") || "");
  const category = categoryRaw as ClientPhotoCategory;
  if (!Object.values(ClientPhotoCategory).includes(category)) throw new Error("区分を選択してください");

  const takenAtRaw = String(formData.get("takenAt") || "");
  const takenAt = takenAtRaw ? new Date(takenAtRaw) : new Date();
  const note = String(formData.get("note") || "") || null;

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
