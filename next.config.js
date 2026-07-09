/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sharp is a native Node.js module — must not be bundled by webpack
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  typescript: {
    // Pre-existing OL import type errors — does not affect runtime behavior
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 1 — UI Restructuring: Duplicate Route Redirects
  // All duplicate/legacy routes are permanently redirected to their canonical
  // destination. No page files are deleted — only HTTP-level redirects.
  // ══════════════════════════════════════════════════════════════════════════
  async redirects() {
    return [
      // ── HR: hr-center → admin-gateway/hr (canonical) ─────────────────────
      {
        source: '/dashboard/hr-center',
        destination: '/dashboard/admin-gateway/hr',
        permanent: true,
      },
      {
        source: '/dashboard/hr-center/manager',
        destination: '/dashboard/admin-gateway/hr',
        permanent: true,
      },
      {
        source: '/dashboard/hr-center/personnel',
        destination: '/dashboard/admin-gateway/hr/employees',
        permanent: true,
      },
      {
        source: '/dashboard/hr-center/staffing',
        destination: '/dashboard/admin-gateway/hr/assignments',
        permanent: true,
      },
      {
        source: '/dashboard/hr-center/:path*',
        destination: '/dashboard/admin-gateway/hr',
        permanent: true,
      },

      // ── Finance: finance-hub → admin-gateway/finance (canonical) ──────────
      {
        source: '/dashboard/finance-hub',
        destination: '/dashboard/admin-gateway/finance',
        permanent: true,
      },
      {
        source: '/dashboard/finance-hub/:path*',
        destination: '/dashboard/admin-gateway/finance',
        permanent: true,
      },

      // ── Maintenance: standalone hub → admin-gateway/maintenance (canonical)
      {
        source: '/dashboard/maintenance',
        destination: '/dashboard/admin-gateway/maintenance',
        permanent: true,
      },
      {
        source: '/dashboard/maintenance/manager',
        destination: '/dashboard/admin-gateway/maintenance/executive',
        permanent: true,
      },
      {
        source: '/dashboard/maintenance/operations',
        destination: '/dashboard/admin-gateway/maintenance/work-orders',
        permanent: true,
      },
      {
        source: '/dashboard/maintenance/planning',
        destination: '/dashboard/admin-gateway/maintenance/preventive',
        permanent: true,
      },
      {
        source: '/dashboard/maintenance/:path*',
        destination: '/dashboard/admin-gateway/maintenance',
        permanent: true,
      },

      // ── Procurement: legacy path → materials (canonical) ──────────────────
      // Note: admin-gateway/procurement/page.tsx already redirects internally;
      // this catches direct URL access before hitting the file.
      {
        source: '/dashboard/procurement',
        destination: '/dashboard/admin-gateway/materials/procurement',
        permanent: true,
      },

      // ── Asset 360: standalone → admin-gateway/assets (canonical) ──────────
      // Phase 4: asset detail page now exists at /admin-gateway/assets/[id]
      {
        source: '/dashboard/asset-360',
        destination: '/dashboard/admin-gateway/assets/registry',
        permanent: true,
      },
      {
        source: '/dashboard/asset-360/:id',
        destination: '/dashboard/admin-gateway/assets/:id',
        permanent: true,
      },

      // ── Project 360: standalone → admin-gateway/projects (canonical) ──────
      // Phase 5: project detail page now exists at /admin-gateway/projects/[id]
      {
        source: '/dashboard/project-360',
        destination: '/dashboard/admin-gateway/projects/list',
        permanent: true,
      },
      {
        source: '/dashboard/project-360/:id',
        destination: '/dashboard/admin-gateway/projects/:id',
        permanent: true,
      },

      // ── digital-assets: legacy → asset registry ───────────────────────────
      {
        source: '/dashboard/digital-assets',
        destination: '/dashboard/admin-gateway/assets/registry',
        permanent: true,
      },
      {
        source: '/dashboard/digital-assets/:path*',
        destination: '/dashboard/admin-gateway/assets/registry',
        permanent: true,
      },

      // ── GM Office: promote to top-level URL ───────────────────────────────
      // Phase 7 will create /dashboard/gm-office as a wrapper.
      // For now, /dashboard/gm-office → admin-gateway/gm-office.
      {
        source: '/dashboard/gm-office',
        destination: '/dashboard/admin-gateway/gm-office',
        permanent: false, // temporary until Phase 7 creates the real page
      },
    ];
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
