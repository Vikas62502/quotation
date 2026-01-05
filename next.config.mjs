/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep TypeScript relaxed for build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Required when deploying without Next image optimizer
  images: {
    unoptimized: true,
  },

  // Standalone output for Docker (best practice)
  output: 'standalone',
};

export default nextConfig;
