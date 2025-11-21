const isStaticExport = process.env.NODE_ENV === 'production'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

if (isStaticExport) {
  // Enable static export for S3 deployment – custom headers must be configured at the CDN layer.
  nextConfig.output = 'export'
} else {
  // Only apply custom headers when Next can serve them (i.e., not during static export).
  nextConfig.headers = async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-cache, no-store, must-revalidate',
        },
      ],
    },
  ]
}

module.exports = nextConfig
