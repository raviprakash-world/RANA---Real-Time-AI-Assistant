import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (built on pdfjs-dist) resolves a worker script at runtime via
  // native Node `require` — bundling it breaks that resolution, so it needs
  // to stay external rather than go through Turbopack/webpack like most
  // dependencies (see /api/parse-file/route.ts).
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
