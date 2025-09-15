// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Moved out of experimental.* (current Next supports top-level)  
  typedRoutes: true,
  
  // Fix cross-origin request issues for authentication
  allowedDevOrigins: ["127.0.0.1", "localhost"],



  webpack: (config, { isServer }) => {
    // 1) Emit pdf.js worker files as asset URLs so dynamic import returns a string
    config.module.rules.push({
      test: /pdf\.worker(\.min)?\.(m)?js$/,
      type: "asset/resource",
    });

    // 2) Some pdfjs-dist builds ship ESM (.mjs). Ensure resolution works even if "fullySpecified" is required.
    //    (This prevents errors like "Cannot find module 'pdfjs-dist/build/pdf.mjs' with fullySpecified.")
    config.module.rules.push({
      test: /node_modules\/pdfjs-dist\/build\/pdf\.m?js$/,
      resolve: { fullySpecified: false },
    });

    // 3) Don’t try to polyfill Node core modules in the browser bundle.
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
};

export default nextConfig;