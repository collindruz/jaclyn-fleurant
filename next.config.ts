import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [60, 75, 85, 90],
    imageSizes: [16, 32, 48, 64, 80, 96, 128, 160, 256, 384],
    deviceSizes: [640, 750, 828, 1080, 1200, 1600, 1920],
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.vimeocdn.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/about", destination: "/info", permanent: true },
      { source: "/contact", destination: "/info", permanent: true },
      { source: "/write", destination: "/info", permanent: true },
    ];
  },
};

export default nextConfig;
