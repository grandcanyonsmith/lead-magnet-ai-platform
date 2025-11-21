import JobDetailClient from './page-client'

export async function generateStaticParams(): Promise<{ slug: string[] }[]> {
  // Return at least one placeholder route to satisfy Next.js static export requirements
  // Actual routes will be handled client-side via CloudFront fallback
  return [{ slug: ['_'] }]
}

export default function JobDetailPage() {
  return <JobDetailClient />
}

