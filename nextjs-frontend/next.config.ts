import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "echarts"],
  },
};

export default nextConfig;
