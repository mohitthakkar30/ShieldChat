import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Use Turbopack with resolve aliases for Node.js modules
  turbopack: {
    resolveAlias: {
      // Stub out Node.js modules not available in browser
      fs: { browser: "./src/lib/stubs/empty.js" },
      path: { browser: "./src/lib/stubs/empty.js" },
    },
  },
  webpack: (config, { isServer }) => {
    // Polyfills for Node.js modules used by @arcium-hq/client (for webpack fallback)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
