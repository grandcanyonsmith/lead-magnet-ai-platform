// For static export, we need to export dynamicParams to allow dynamic routes
// even when generateStaticParams returns empty array
export const dynamicParams = true

import EditWorkflowClient from './page-client'

export async function generateStaticParams(): Promise<{ id: string }[]> {
  // Return empty array - routes will be handled client-side via CloudFront fallback
  // CloudFront is configured to serve /index.html for 404s, enabling SPA routing
  return []
}

export default function EditWorkflowPage() {
  return <EditWorkflowClient />
}

