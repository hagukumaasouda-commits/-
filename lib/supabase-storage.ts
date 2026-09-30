import { createClient } from "@supabase/supabase-js";

// 姿勢写真・インボディ結果の画像本体を保存する場所。docs/client-photos-spec-v2.md
// 要配慮個人情報にあたりうるため、DB(Supabase・東京リージョン)と同じSupabaseプロジェクト内の
// 非公開バケットに置き、常に短時間有効の署名付きURL経由でのみ配信する(公開URLは使わない)。
const BUCKET = "client-photos";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60;

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  return createClient(url, key);
}

export async function uploadClientPhoto(clientId: string, file: File): Promise<string> {
  const supabase = getSupabaseClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${clientId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw new Error(`画像のアップロードに失敗しました: ${error.message}`);

  return path;
}

export async function getClientPhotoSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function getClientPhotoSignedUrls(storagePaths: string[]): Promise<Map<string, string>> {
  if (storagePaths.length === 0) return new Map();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(storagePaths, SIGNED_URL_EXPIRES_IN_SECONDS);
  if (error || !data) return new Map();
  return new Map(
    data.filter((d): d is typeof d & { signedUrl: string } => !!d.signedUrl && !d.error).map((d) => [d.path!, d.signedUrl])
  );
}

export async function deleteClientPhoto(storagePath: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(`画像の削除に失敗しました: ${error.message}`);
}
