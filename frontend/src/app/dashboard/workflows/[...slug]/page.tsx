import WorkflowDetailClient from './page-client'
import EditWorkflowClient from './EditWorkflowClient'

type WorkflowPageParams = {
  params: {
    slug?: string[]
  }
}

export async function generateStaticParams(): Promise<{ slug: string[] }[]> {
  // Return placeholder routes for both detail view (_)
  // and edit view (_/edit) to satisfy static export requirements.
  return [{ slug: ['_'] }, { slug: ['_', 'edit'] }]
}

export default function WorkflowPage({ params }: WorkflowPageParams) {
  const slug = params.slug ?? []
  const isEditView = slug.length > 1 && slug[1] === 'edit'

  if (isEditView) {
    return <EditWorkflowClient />
  }

  return <WorkflowDetailClient />
}

