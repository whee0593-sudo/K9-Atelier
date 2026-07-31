import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    SITE_ACCESS_PASSWORD: process.env.SITE_ACCESS_PASSWORD,
  },
};

export default nextConfig;
