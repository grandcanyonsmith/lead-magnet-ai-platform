import WorkflowDetailClient from './page-client'

export async function generateStaticParams(): Promise<{ id: string }[]> {
  // Return at least one placeholder route to satisfy Next.js static export requirements
  // Actual routes will be handled client-side via CloudFront fallback
  return [{ id: '_' }]
}

export default function WorkflowDetailPage() {
  return <WorkflowDetailClient />
}

