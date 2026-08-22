import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Some Windows setups end up with a persistent OS-level lock on
  // .next/dev/logs/next-development.log (Next 16's dev-mode browser-log
  // file, written regardless of the experimental.mcpServer flag) -- once
  // locked, `next dev` crashes on startup every time with an EPERM on that
  // file's unlink/open, and no live process holds the handle to release.
  // Building into a fresh directory sidesteps the whole path. Harmless
  // elsewhere (this is purely where build/dev artifacts live).
  distDir: '.next-dev',
  serverExternalPackages: ['@huggingface/transformers'],
  allowedDevOrigins: ['192.168.0.100', '192.168.15.42'],
  experimental: {
    // Next 16's experimental dev-mode MCP server writes every browser
    // console log to <distDir>/dev/logs/next-development.log. On this
    // machine that file gets locked (EPERM on open/unlink) by something
    // outside our control immediately after the dev server reports "Ready",
    // crashing the whole process before it can serve a single request.
    // Disabling it has no effect on the app itself -- it's a dev-only
    // log/debugging aid, not used by any app code or by the Playwright suite.
    mcpServer: false,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
