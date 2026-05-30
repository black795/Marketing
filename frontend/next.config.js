/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/assets/:path*',
        destination: `${BACKEND_URL}/assets/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
