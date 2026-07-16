import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/sales",
        destination: "/work/sales/",
        permanent: true,
      },
      {
        source: "/sales/:path*",
        destination: "/work/sales/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // Serve the Vite Sales OS SPA for client routes under /work/sales/*.
    // Existing files in public/work/sales still win via afterFiles.
    return {
      afterFiles: [
        {
          source: "/work/sales",
          destination: "/work/sales/index.html",
        },
        {
          source: "/work/sales/",
          destination: "/work/sales/index.html",
        },
        {
          source: "/work/sales/:path*",
          destination: "/work/sales/index.html",
        },
      ],
    };
  },
};

export default nextConfig;
