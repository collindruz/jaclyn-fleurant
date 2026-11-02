import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 85, 90],
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.vimeocdn.com" },
    ],
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
