/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), gyroscope=(self), accelerometer=(self), xr-spatial-tracking=(self)' },
];
module.exports = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['three'],
  experimental: { serverComponentsExternalPackages: ['ioredis', 'bcryptjs'] },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
