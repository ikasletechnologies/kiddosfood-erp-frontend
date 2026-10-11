/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  // output: 'export', // Required for standard Hostinger shared hosting
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ignored: ['**/node_modules', '**/pagefile.sys', '**/hiberfil.sys', '**/swapfile.sys', '**/.next'],
    };
    return config;
  },
};

module.exports = nextConfig;


