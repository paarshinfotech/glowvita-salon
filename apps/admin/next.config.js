const path = require('path');
require('dotenv').config({ path: '../../.env' });
const libPackageJson = require('../../packages/lib/package.json');
const storePackageJson = require('../../packages/store/package.json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/store", "@repo/lib", "@repo/config", "@repo/utils"],
  staticPageGenerationTimeout: 1000,
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  output: 'standalone',
  poweredByHeader: false,
  webpack: (config, { isServer }) => {
    config.resolve.alias['@repo/config'] = path.resolve(__dirname, '../../packages/config');

    // Dynamic aliases from @repo/lib exports
    if (libPackageJson.exports) {
      Object.keys(libPackageJson.exports).forEach(key => {
        if (key.startsWith('./')) {
          const aliasKey = key.replace('.', '@repo/lib') + '$';
          const targetPath = path.resolve(__dirname, '../../packages/lib', libPackageJson.exports[key]);
          config.resolve.alias[aliasKey] = targetPath;
        }
      });
    }

    // Dynamic aliases from @repo/store exports
    if (storePackageJson.exports) {
      Object.keys(storePackageJson.exports).forEach(key => {
        if (key.startsWith('./')) {
          const aliasKey = key.replace('.', '@repo/store') + '$';
          const targetPath = path.resolve(__dirname, '../../packages/store', storePackageJson.exports[key]);
          config.resolve.alias[aliasKey] = targetPath;
        }
      });
    }

    // Handle canvas.node binary files
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader',
    });

    // For server-side builds, provide a fallback for canvas
    if (isServer) {
      config.externals = [
        ...config.externals,
        {
          canvas: 'commonjs canvas',
        },
      ];
    }

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'v2winonline.com',
        port: '',
        pathname: '/**',
      },  
      {
        protocol: 'https',
        hostname: 'glowvitasalon.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'v2winonline.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/**',
      },
    ],

  },

  env: {
    NEXT_PUBLIC_MAPBOX_API_KEY: process.env.MAPBOX_API_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  }
};

module.exports = nextConfig;