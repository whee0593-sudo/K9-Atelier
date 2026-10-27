import type { NextConfig } from "next";
import { PERMANENT_REDIRECTS } from "./src/lib/site-redirects";

const nextConfig: NextConfig = {
  // Test fixtures are checked by the test runner, not the production compiler.
  typescript: { tsconfigPath: "tsconfig.build.json" },
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
