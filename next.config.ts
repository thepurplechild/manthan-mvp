import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Move typedRoutes to the top-level (was experimental.typedRoutes)
  typedRoutes: true,
  webpack: (config, { isServer }) => {
    // Emit pdf.worker as an asset and resolve to a URL string
    config.module.rules.push({
      test: /pdf\.worker(\.min)?\.(m)?js$/,
      type: 'asset/resource',
    })
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        crypto: false,
      }
    }
    return config
  },
}

export default nextConfig
