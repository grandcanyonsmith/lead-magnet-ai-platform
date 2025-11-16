import { useMemo } from 'react'
import { Workflow } from '@/shared/types'

export function useWorkflowFolders(filteredWorkflows: Workflow[]) {
  const workflowsByFolder = useMemo(() => {
    const grouped: Record<string, Workflow[]> = {}
    const uncategorized: Workflow[] = []

    filteredWorkflows.forEach((workflow) => {
      if (workflow.folder_id) {
        if (!grouped[workflow.folder_id]) {
          grouped[workflow.folder_id] = []
        }
        grouped[workflow.folder_id].push(workflow)
      } else {
        uncategorized.push(workflow)
      }
    })

    return { grouped, uncategorized }
  }, [filteredWorkflows])

  return workflowsByFolder
}

