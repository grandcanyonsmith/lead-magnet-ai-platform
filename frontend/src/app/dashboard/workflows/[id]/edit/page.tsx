import EditWorkflowClient from './page-client'

export async function generateStaticParams(): Promise<{ id: string }[]> {
  // Return empty array for dynamic routes - Next.js will handle these at runtime
  // For static export, we rely on fallback behavior
  return []
}

export const dynamicParams = true

export default function EditWorkflowPage() {
  return <EditWorkflowClient />
}

