// For static export, we need to export dynamicParams to allow dynamic routes
// even when generateStaticParams returns empty array
export const dynamicParams = true

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // Return empty array - routes will be handled client-side via CloudFront fallback
  // CloudFront is configured to serve /index.html for 404s, enabling SPA routing
  return []
}

import PublicFormClient from './page-client'

export default function PublicFormPage() {
  return <PublicFormClient />
}
