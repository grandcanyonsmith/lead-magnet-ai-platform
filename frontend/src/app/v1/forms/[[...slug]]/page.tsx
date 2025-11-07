import PublicFormClient from './page-client'

export async function generateStaticParams(): Promise<{ slug: string[] }[]> {
  // Return at least one placeholder route to satisfy Next.js static export requirements
  // Actual routes will be handled client-side via CloudFront fallback
  // CloudFront is configured to serve /index.html for 404s, enabling SPA routing
  return [{ slug: ['_'] }]
}

export default function PublicFormPage() {
  return <PublicFormClient />
}
