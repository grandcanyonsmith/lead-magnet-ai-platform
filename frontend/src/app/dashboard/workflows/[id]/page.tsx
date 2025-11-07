import WorkflowDetailClient from './page-client'

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return []
}

export default function WorkflowDetailPage() {
  return <WorkflowDetailClient />
}

