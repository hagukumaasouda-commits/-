import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 姿勢写真・インボディ結果の画像(スマホカメラ撮影)を受け付けるため、既定の1MBから引き上げる。
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
