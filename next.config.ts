import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'si.geilicdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.geilicdn.com',
      },
    ],
  },
};

export default nextConfig;
