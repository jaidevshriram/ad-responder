import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // The Next.js badge sits over the ad's lower-left lockup during demos.
  devIndicators: false,
  turbopack: { root: process.cwd() },
};

export default nextConfig;
