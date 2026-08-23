/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: 'export', // Required for standard Hostinger shared hosting
  images: {
    unoptimized: true, // Required for static export
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ignored: ['**/node_modules', '**/pagefile.sys', '**/.next'],
    };
    return config;
  },
};

module.exports = nextConfig;


