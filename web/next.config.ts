import type { NextConfig } from "next";

// World Cup endpoints moved under /api/v1/wc2026/*; keep the old public paths working.
const LEGACY_WC_ROUTES = ["clubs", "clubs/:club", "players", "meta", "timeseries", "stats/:stat"];

const nextConfig: NextConfig = {
  async rewrites() {
    return LEGACY_WC_ROUTES.map((r) => ({
      source: `/api/v1/${r}`,
      destination: `/api/v1/wc2026/${r}`,
    }));
  },
};

export default nextConfig;
