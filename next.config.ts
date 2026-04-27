import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/about", destination: "/info", permanent: true },
      { source: "/contact", destination: "/info", permanent: true },
      { source: "/write", destination: "/info", permanent: true },
    ];
  },
};

export default nextConfig;
