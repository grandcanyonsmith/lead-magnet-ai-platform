/** @type {import('next').NextConfig} */
const isStaticExport =
  process.env.NODE_ENV === 'production' && process.env.STATIC_EXPORT !== 'false'

const nextConfig = {
  // We deploy the dashboard as a static export to S3 + CloudFront.
  // NOTE: Next.js `headers()`, `redirects()`, and `rewrites()` are NOT applied in static export mode.
  ...(isStaticExport ? { output: 'export' } : {}),
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
  // Cache-Control is applied at deploy time (S3 object metadata / CloudFront caching), not here.
}

module.exports = nextConfig
