/** @type {import('next').NextConfig} */
const PAGES = process.env.PAGES_BUILD === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), gyroscope=(self), accelerometer=(self), xr-spatial-tracking=(self)' },
];

const base = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['three'],
};

module.exports = PAGES
  ? // GitHub Pages: fully static export served under /<repo-name>/
    { ...base, output: 'export', basePath, assetPrefix: basePath || undefined, trailingSlash: true, images: { unoptimized: true } }
  : {
      ...base,
      experimental: { serverComponentsExternalPackages: ['ioredis', 'bcryptjs'] },
      async headers() {
        return [{ source: '/:path*', headers: securityHeaders }];
      },
    };
