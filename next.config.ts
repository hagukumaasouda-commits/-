import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 予約CSV取り込み用。姿勢写真・インボディ結果の画像はVercelのサーバー関数自体のボディサイズ上限
      // (約4.5MB、ここでは変更できない)に引っかかるため、Supabase Storageへブラウザから直接
      // アップロードする方式にしており、この設定の対象外(docs/client-photos-upload-fix-v2.md)。
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
