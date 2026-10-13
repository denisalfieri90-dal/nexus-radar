import type { NextConfig } from "next";

// Sito statico: viene pubblicato su Render Static Site (gratuito, sempre acceso, su CDN).
// I dati arrivano come file JSON in /data, prodotti dalla pipeline GitHub Actions.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
