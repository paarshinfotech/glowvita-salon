import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const libPackageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../packages/lib/package.json'), 'utf8'));
const storePackageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../packages/store/package.json'), 'utf8'));

import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from '../../packages/config/config.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ["@repo/ui", "@repo/lib", "@repo/store", "@repo/config"],
  staticPageGenerationTimeout: 300,
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  env: {
    RAZORPAY_KEY_ID: RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: RAZORPAY_KEY_SECRET,
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || RAZORPAY_KEY_ID,
  },
  async headers() {
    return [
      {
        // Apply these headers to all API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
        ],
      },
    ];
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
        hostname: 'picsum.photos',
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
        protocol: 'https',
        hostname: 'glowvitasalon.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.logo.wine',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'v2winonline.com',
        port: '',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // This helps with external image failures
    unoptimized: false, // Keep optimization, but handle errors
    minimumCacheTTL: 60,
  },
  webpack: (config, { dev, isServer }) => {
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

    if (dev && !isServer) {
      config.infrastructureLogging = {
        level: 'error',
      };
    }

    return config;
  },
};

export default nextConfig;