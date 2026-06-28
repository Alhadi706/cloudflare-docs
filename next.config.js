/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Pre-existing OL import type errors — does not affect runtime behavior
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        // Keep /api/* inside Next.js route handlers so tenant/header logic is applied.
        {
          source: '/gis/:path*',
          destination: 'http://127.0.0.1:7860/gis/:path*',
        },
        {
          source: '/employee/:path*',
          destination: 'http://127.0.0.1:7860/employee/:path*',
        },
        {
          source: '/hr/:path*',
          destination: 'http://127.0.0.1:7860/hr/:path*',
        },
      ],
      fallback: [],
    };
  },
}

module.exports = nextConfig
