/** @type {import('next').NextConfig} */
const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

// We deploy the dashboard as a static export to S3 + CloudFront by default.
// However, Vercel deployments should NOT default to static export, because deep links
// like /dashboard/workflows/<id> will 404 without CloudFront-style rewrites.
//
// On Vercel, the environment variable `VERCEL=1` is always set.
const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL_ENV;

// Override behavior explicitly via STATIC_EXPORT:
// - STATIC_EXPORT=false  => never export
// - STATIC_EXPORT=true   => always export (even on Vercel)
// - unset               => export on non-Vercel production builds only
const staticExportFlag = process.env.STATIC_EXPORT;

module.exports = (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  // IMPORTANT:
  // Use a separate dist dir for dev vs build so `next build` (and deployments)
  // can't corrupt a running `next dev` instance (which can cause "Cannot find module './<id>.js'" errors).
  const distDir = isDev ? ".next-dev" : ".next";

  const isStaticExport =
    !isDev &&
    process.env.NODE_ENV === "production" &&
    (staticExportFlag === undefined
      ? !isVercel
      : staticExportFlag !== "false");

  return {
    // NOTE: Next.js `headers()`, `redirects()`, and `rewrites()` are NOT applied in static export mode.
    ...(isStaticExport ? { output: "export" } : {}),
    distDir,
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
  };
};
