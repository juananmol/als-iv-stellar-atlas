import type { NextConfig } from 'next';

const basePath = process.env.PAGES_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  // GitHub Pages only serves static files. The map is fully client-side, so a
  // static export preserves all of its interactive features without a server.
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
};

export default nextConfig;
