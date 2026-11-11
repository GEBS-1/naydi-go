import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ['jimp','image-size'],
};

export default nextConfig;
