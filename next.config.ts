import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Serve the Vite Sales OS SPA for client routes under /sales/*
    // Existing files in public/sales (JS/CSS/assets) still win via afterFiles.
    return {
      afterFiles: [
        {
          source: "/sales",
          destination: "/sales/index.html",
        },
        {
          source: "/sales/",
          destination: "/sales/index.html",
        },
        {
          source: "/sales/:path*",
          destination: "/sales/index.html",
        },
      ],
    };
  },
};

export default nextConfig;
