import EditWorkflowClient from './page-client'

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return []
}

export default function EditWorkflowPage() {
  return <EditWorkflowClient />
}

