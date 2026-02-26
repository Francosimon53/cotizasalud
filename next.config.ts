import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/agentes", destination: "/agentes.html" },
    ];
  },
};
export default nextConfig;
