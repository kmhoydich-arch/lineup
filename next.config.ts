import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is opened at 127.0.0.1 while the dev server also allows localhost.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
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
