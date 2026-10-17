import type { NextConfig } from "next";
import { PERMANENT_REDIRECTS } from "./src/lib/site-redirects";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 90],
  },
  async redirects() {
    return PERMANENT_REDIRECTS.map((redirect) => ({
      source: redirect.source,
      destination: redirect.destination,
      statusCode: redirect.statusCode,
    }));
  },
};

export default nextConfig;
